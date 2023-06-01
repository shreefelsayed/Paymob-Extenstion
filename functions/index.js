/*
 * Copyright 2023 Armjld, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
admin.initializeApp();

exports.onNewPaymentRequest = functions.firestore.document("paymentRequests/{payment_id}").onCreate(async (data, context) => {
  logger.log("New Request Made");
  const paymentData = data.data();
  const id = data.id;
  var paymentUrl = "";
  var integrationId = "";


  await admin.firestore().collection("paymentRequests").doc(id).update({ "id": id, "timestamp": new Date() });

  if (paymentData.firstName == undefined ||
    paymentData.lastName == undefined ||
    paymentData.priceEGP == undefined ||
    paymentData.emailAddress == undefined ||
    paymentData.phoneNumber == undefined ||
    paymentData.paymentType == undefined) {

    await admin.firestore().collection("paymentRequests").doc(id).update({ "statue": "Missing data in the document" });
    logger.log("Missing data in the document");
    return;
  }

  if (paymentData.paymentType == "Credit Card") {
    integrationId = process.env.creditCardId;
  } else if (paymentData.paymentType == "Mobile Wallet") {
    if(process.env.mobileWalletId == undefined) {
      await admin.firestore().collection("paymentRequests").doc(id).update({ "statue": "Missing Mobile Payment Intergration id, set in the extenstion settings" });
      logger.log("Missing Mobile Payment Intergration id, set in the extenstion settings");
      return;
    }
    integrationId = process.env.mobileWalletId;
  }

  // --> Set the statue to (Pending Server)
  await admin.firestore().collection("paymentRequests").doc(id).update({ "statue": "Pending Server" });

  // --> We get the payment token for the selected payment type
  var token = await getPaymentKey(integrationId, paymentData);
  const paymentKey = token.paymentKey;

  // --> we make the request depending on the payment type
  if (paymentData.paymentType == "Credit Card") {
    paymentUrl = "https://accept.paymob.com/api/acceptance/iframes/" + process.env.IFRAME + "?payment_token=" + paymentKey;
    logger.log("Credit Card payment request url " + paymentUrl);
  } else if (paymentData.paymentType == "Mobile Wallet") {
    
    paymentUrl = await getWalletUrl(paymentData.phoneNumber, paymentKey);
    logger.log("Wallet payment request url " + paymentUrl);
  } else {
    await admin.firestore().collection("paymentRequests").doc(id).update({ "statue": "Payment type should either be Credit Card, or Mobile Wallet" });
    console.error("Payment type should either be Credit Card, or Mobile Wallet");
    return;
  }

  // --> return the url of the payment link and update the statue from (Pending payment) and set the order id

  await admin.firestore().collection("paymentRequests").doc(id).update({ "statue": "Pending Payment", "paymentLink": paymentUrl, "paymobOrderId": token.orderId + "" });
});

exports.onPaymentMade = functions.https.onRequest(async (req, res) => {
  const body = JSON.parse(JSON.stringify(req.body)).obj;

  const orderId = body.order.id + "";
  const statue = body.success;
  const service = body.data.wallet_issuer;

  // --> Check if request exists
  const walletReq = await admin.firestore().collection("paymentRequests").where("paymobOrderId", "==", orderId).limit(1).get();
  if (walletReq.empty) {
    logger.log("No request was found for this order");
    res.send("ERROR");
    return;
  }

  const request = walletReq.docs[0].data();

  // --> Check if the request is pending
  if (request.statue != "Pending Payment") {
    logger.log("Request Statue is already " + request.statue);
    await admin.firestore().collection("paymentRequests").doc(request.id).update({ "statue": "Failed" });
    res.send("ERROR");
    return;
  }

  if (!statue) {
    logger.log("Response Statue is failed");
    await admin.firestore().collection("paymentRequests").doc(request.id).update({ "statue": "Failed" });
    res.send("ERROR");
    return;
  }

  if (service != undefined) {
    await admin.firestore().collection("paymentRequests").doc(request.id).update({ "statue": "Success", "service_provider": service });
  } else {
    await admin.firestore().collection("paymentRequests").doc(request.id).update({ "statue": "Success" });
  }
  res.send("OK");
})

async function getWalletUrl(phone, key) {
  var request = require("request-promise");
  var walletRequestOption = {
    method: 'POST',
    url: 'https://accept.paymob.com/api/acceptance/payments/pay',
    json: {
      "source": {
        "identifier": phone,
        "subtype": "WALLET"
      },
      "payment_token": key
    }
  };

  const walletRequestResult = await request(walletRequestOption);
  logger.log("Wallet respone : " + JSON.stringify(walletRequestOption))
  const redirect_url = JSON.parse(JSON.stringify(walletRequestResult)).redirect_url + "";
  return redirect_url;
}

async function getPaymentKey(integrationId, paymentData) {
  var request = require("request-promise");
  var amountCent = Math.round(paymentData.priceEGP * 100);

  // make a request with api_key prameter to get the token content type is json
  var tokenOptions = {
    method: 'POST',
    url: 'https://accept.paymob.com/api/auth/tokens',
    json: {
      "api_key": process.env.paymobApi
    }
  };

  const tokenResult = await request(tokenOptions);
  const token = JSON.parse(JSON.stringify(tokenResult)).token;
  logger.log("Got the payment token");

  // create and order id with request.
  var orderIdOptions = {
    method: 'POST',
    url: 'https://accept.paymob.com/api/ecommerce/orders',
    json: {
      "auth_token": token,
      "delivery_needed": "false",
      "amount_cents": amountCent + "",
      "currency": "EGP",
    }
  };

  const orderIdResult = await request(orderIdOptions);
  const orderId = JSON.parse(JSON.stringify(orderIdResult)).id;

  var paymentKeyRequest = {
    method: 'POST',
    url: 'https://accept.paymob.com/api/acceptance/payment_keys',
    json: {
      "auth_token": token,
      "amount_cents": amountCent + "",
      "expiration": 3600,
      "order_id": orderId + "",
      "billing_data": {
        "apartment": "NA",
        "email": paymentData.emailAddress,
        "floor": "NA",
        "first_name": paymentData.firstName,
        "street": "NA",
        "building": "NA",
        "phone_number": paymentData.phoneNumber,
        "shipping_method": "NA",
        "postal_code": "NA",
        "city": "NA",
        "country": "EG",
        "last_name": paymentData.lastName,
        "state": "NA"
      },
      "currency": "EGP",
      "integration_id": integrationId,
      "lock_order_when_paid": "false"
    }
  };

  const paymentKeyResult = await request(paymentKeyRequest);
  const paymentKey = JSON.parse(JSON.stringify(paymentKeyResult)).token;
  logger.log("Got the payment Key");

  return {
    paymentKey: paymentKey,
    orderId: orderId
  };
}