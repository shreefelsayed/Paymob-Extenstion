/*
 * This template contains a HTTP function that
 * responds with a greeting when called
 *
 * Reference PARAMETERS in your functions code with:
 * `process.env.<parameter-name>`
 * Learn more about building extensions in the docs:
 * https://firebase.google.com/docs/extensions/alpha/overview
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

exports.onNewPaymentRequest = functions.firestore.document("paymentRequests/{payment_id}").onCreate(async (data, context) => {
  logger.log("New Request Made");
  const paymentData = data.data();
  var paymentUrl = "";
  var integrationId = "";

  // --> Check if all fields does exist (First name - Last name - Price in EGP - email address - phone number - payment type)
  if (paymentData.firstName == undefined ||
    paymentData.lastName == undefined ||
    paymentData.priceEGP == undefined ||
    paymentData.emailAddress == undefined ||
    paymentData.phoneNumber == undefined ||
    paymentData.paymentType == undefined) {

    await data.ref.update({ "statue": "Missing data in the document", "id": data.id });
    logger.log("Missing data in the document");
    return;
  }

  if (paymentData.paymentType == "Credit Card") {
    integrationId = process.env.creditCardId;
  } else if (paymentData.paymentType == "Mobile Wallet") {
    integrationId = process.env.mobileWalletId;
  }

  // --> Set the statue to (Pending Server)
  await data.ref.update({ "statue": "Pending Server", "timestamp": new Date() });

  // --> We get the payment token for the selected payment type

  var token = await getPaymentKey(integrationId, paymentData);
  const paymentKey = token.paymentKey;

  // --> we make the request depending on the payment type
  if (paymentData.paymentType == "Credit Card") {
    paymentUrl = "https://accept.paymob.com/api/acceptance/iframes/" + process.env.IFRAME + "?payment_token=" + paymentKey;
    logger.log("Credit Card payment request url " + paymentUrl);
  } else if (paymentData.paymentType == "Mobile Wallet") {
    paymentUrl = getWalletUrl(paymentData.phoneNumber, paymentKey);
    logger.log("Wallet payment request url " + paymentUrl);
  } else {
    await data.ref.update({ "statue": "Payment type should either be Credit Card, or Mobile Wallet" });
    console.error("Payment type should either be Credit Card, or Mobile Wallet");
    return;
  }

  // --> return the url of the payment link and update the statue from (Pending payment) and set the order id

  await data.ref.update({ "statue": "Pending Payment", "paymentLink": paymentUrl, "paymobOrderId": token.orderId });
});

exports.onPaymentMade = functions.https.onRequest(async (req, res) => {
  const body = JSON.parse(JSON.stringify(req.body)).obj;

  const orderId = body.order.id + "";
  const statue = body.success;
  const service = body.data.wallet_issuer;

  // --> Check if request exists
  const walletReq = await admin.firestore().collection(process.env.PAYMENT_COLLECTION).where("paymobOrderId", "==", orderId).limit(1).get();
  if (walletReq.empty) {
    logger.log("No request was found for this order");
    res.send("ERROR");
    return;
  }

  // --> Check if the request is pending
  if (walletReq[0].data().statue != "Pending Payment") {
    logger.log("Request Statue is already " + walletReq[0].data().statue);
    res.send("ERROR");
    return;
  }

  if (!statue) {
    logger.log("Response Statue is failed");
    awaitwalletReq[0].ref.update({ "statue": "Failed", "service_provider": service });
    res.send("ERROR");
    return;
  }

  await walletReq[0].ref.update({ "statue": "Success", "service_provider": service });
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