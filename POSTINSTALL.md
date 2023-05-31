# How should you connect to paymob
The callback link for onNewPaymentRequest:
${function:onNewPaymentRequest.url}

# Using the extension

In your paymob dashboard, edit the intergration Transaction processed callback to this link (This step is important) :
${function:onNewPaymentRequest.url}

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

<!-- We recommend keeping the following section to explain how to monitor extensions with Firebase -->
# Monitoring
As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
