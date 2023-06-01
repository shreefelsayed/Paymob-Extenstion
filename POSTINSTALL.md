# Things todo in paymob dashboard
- Create a integration for credit card and mobile wallet (optional)
- Edit the callback link :
In your paymob dashboard, edit the intergration Transaction processed callback to this link (This step is important) :
${function:onPaymentMade.url}

# How to trigger the extension
Then create a document at firestore with collection "paymentRequests/{doc_id}"
This document should contain the following variables :
firstName -> String
lastName  -> String
priceEGP -> String
emailAddress -> String (Email address of the user who wants to make the payment)
phoneNumber -> String (Phone number of the user mobile wallet in case of making a mobile wallet payment)
paymentType -> "Credit Card", "Mobile Wallet" -> Choose one of thoose value

# How to check if payment was successful
After creating this document, it will be updated with a payment link to navigate your user to.
Then when the user make the payment the statue will be "Success" so you know the payment was made.

# Monitoring
As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
