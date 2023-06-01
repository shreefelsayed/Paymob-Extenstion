Use this extension to connect your project to paymob account.
All you need to do is create an account with paymob.com
and copy the integration keys and the api key and the iframe id from the dashboard

# Important
In your paymob dashboard, edit the intergration Transaction processed callback to this link (This step is important) :
${function:onPaymentMade.url}

Then create a document at firestore with collection "paymentRequests/{doc_id}"
This document should contain the following variables :
firstName -> String
lastName  -> String
priceEGP -> String
emailAddress -> String (Email address of the user who wants to make the payment)
phoneNumber -> String (Phone number of the user mobile wallet in case of making a mobile wallet payment)
paymentType -> "Credit Card", "Mobile Wallet" -> Choose one of thoose value


After creating this document, it will be updated with a payment link to navigate your user to.
Then when the user make the payment the statue will be "Success" so you know the payment was made.

<!-- We recommend keeping the following section to explain how billing for Firebase Extensions works -->
# Billing
This extension uses other Firebase or Google Cloud Platform services which may have associated charges:
Firebase Functions

<!-- List all products the extension interacts with -->
- Cloud Functions
- Firestore

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
