//Backend Options
var PAYMILL_PUBLIC_KEY = null;

//State Descriptors
var PAYMILL_PAYMENT_NAME = "Preparing Payment";
var PAYMILL_IMAGE_PATH = null;

//Errortexts
var PAYMILL_ERROR_STRING = "";

function getPaymillCode()
{
	var methods = {
		paymill_creditcard: "cc",
		paymill_directdebit: 'elv'
	};

	if (methods.hasOwnProperty(pmQuery("input[name='payment[method]']:checked").val())) {
		return methods[pmQuery("input[name='payment[method]']:checked").val()];
	}

	return 'other';
}

/**
 * prints debug messages in the log if debug mode is active
 * @param {String} message
 */
function debug(message)
{
	debug_state = pmQuery('.paymill-option-debug-' + getPaymillCode()).val();
	if (debug_state === 1) {
		var displayName = "";
		if (PAYMILL_PAYMENT_NAME === 'paymill_creditcard') {
			displayName = 'Credit Card';
		}
		if (PAYMILL_PAYMENT_NAME === 'paymill_directdebit') {
			displayName = 'Direct Debit';
		}
		if (PAYMILL_PAYMENT_NAME === 'Preparing Payment') {
			displayName = 'Preparing Payment';
		}

		console.log("[" + displayName + "] " + message);
	}
}

/**
 * Event Handler for the display of the card icons
 */
function paymillShowCardIcon()
{
	var brand = paymill.cardType(pmQuery('#paymill_creditcard_number').val());
	brand = brand.toLowerCase();
	pmQuery("#paymill_creditcard_number")[0].className = pmQuery("#paymill_creditcard_number")[0].className.replace(/paymill-card-number-.*/g, '');
	if (brand !== 'unknown') {
		if (brand === 'american express') {
			brand = 'amex';
		}

		pmQuery('#paymill_creditcard_number').addClass("paymill-card-number-" + brand);
	}
}

/**
 * Handles the response of the paymill bridge. saves the token in a formfield.
 * @param {Boolean} error
 * @param {response object} result
 */
function paymillResponseHandler(error, result)
{
	var paymillValidator = new Validation(pmQuery('#paymill_creditcard_number').closest("form").attr("id"));
	paymillValidator.validate();
	if (error) {
		// Appending error
		PAYMILL_ERROR_STRING += error.apierror + "\n";
		debug(error.apierror);
		debug("Paymill Response Handler triggered: Error.");
	} else {
		// Appending Token to form
		debug("Saving Token in Form: " + result.token);
		pmQuery('.paymill-payment-token-' + getPaymillCode()).val(result.token);
	}
}

function getValueIfExist(selector)
{
	if ($$(selector)[0]) {
		return $$(selector)[0].value;
	}
	
	return '';
}

/**
 * 
 * @returns {Boolean}
 */
function paymillSubmitForm()
{
	PAYMILL_PUBLIC_KEY = pmQuery('.paymill-info-public_key-' + getPaymillCode()).val();
	PAYMILL_PAYMENT_NAME = pmQuery("input[name='payment[method]']:checked").val();
	
	switch (PAYMILL_PAYMENT_NAME) {
		case "paymill_creditcard":
			paymill.config('3ds_cancel_label', pmQuery('.paymill_3ds_cancel').val());
			if (pmQuery('.paymill-info-fastCheckout-cc').val() === 'false') {
				var valid = (paymill.validateCvc(pmQuery('#paymill_creditcard_cvc').val()) || paymill.cardType(pmQuery('#paymill_creditcard_number').val()).toLowerCase() === 'maestro')
						 && paymill.validateHolder(pmQuery('#paymill_creditcard_holdername').val()) 
						 && paymill.validateExpiry(pmQuery('#paymill_creditcard_expiry_month').val(), pmQuery('#paymill_creditcard_expiry_year').val()) 
						 && paymill.validateCardNumber(pmQuery('#paymill_creditcard_number').val());
				 
				if (!valid) {
					return false;
				}
				
				var cvc = '000';

				if (pmQuery('#paymill_creditcard_cvc').val() !== '') {
					cvc = pmQuery('#paymill_creditcard_cvc').val();
				}

				debug("Generating Token");
				paymill.createToken({
					amount_int: parseInt(pmQuery('.paymill-payment-amount-' + getPaymillCode()).val()), // E.g. "15" for 0.15 Eur
					currency: pmQuery('.paymill-payment-currency-' + getPaymillCode()).val(), // ISO 4217 e.g. "EUR"
					number: pmQuery('#paymill_creditcard_number').val(),
					exp_month: pmQuery('#paymill_creditcard_expiry_month').val(),
					exp_year: pmQuery('#paymill_creditcard_expiry_year').val(),
					cvc: cvc,
					cardholder: pmQuery('#paymill_creditcard_holdername').val()
				}, paymillResponseHandler);
			}
			break;
		case "paymill_directdebit":
			if (pmQuery('.paymill-info-fastCheckout-elv').val() === 'false') {
				var valid = pmQuery('#paymill_directdebit_holdername').val() !== ''
						 && paymill.validateAccountNumber(pmQuery('#paymill_directdebit_account').val())
						 && paymill.validateBankCode(pmQuery('#paymill_directdebit_bankcode').val());

				if (!valid) {
					return false;
				}

				debug("Generating Token");
				paymill.createToken({
					number: pmQuery('#paymill_directdebit_account').val(),
					bank: pmQuery('#paymill_directdebit_bankcode').val(),
					accountholder: pmQuery('#paymill_directdebit_holdername').val()
				}, paymillResponseHandler);
			}
			break;
	}

	return false;
}

function addPaymillEvents()
{
	var nvElv = {
		'paymill-validate-dd-holdername': new Validator(
			'paymill-validate-dd-holdername',
			getValueIfExist('.paymill-payment-error-holder-elv'),
			function(v) {
				return !(v === '');
			},
			''
		),
		'paymill-validate-dd-account': new Validator(
			'paymill-validate-dd-account',
			getValueIfExist('.paymill-payment-error-number-elv'),
			function(v) {
				return paymill.validateAccountNumber(v);
			},
			''
		),
		'paymill-validate-dd-bankcode': new Validator(
			'paymill-validate-dd-bankcode',
			getValueIfExist('.paymill-payment-error-bankcode'),
			function(v) {
				return paymill.validateBankCode(v);
			},
			''
		)
	};

	Object.extend(Validation.methods, nvElv);

	var nvCc = {
		'paymill-validate-cc-number': new Validator(
			'paymill-validate-cc-number',
			getValueIfExist('.paymill-payment-error-number'),
			function(v) {
				return paymill.validateCardNumber(v);
			},
			''
		),
		'paymill-validate-cc-expdate-month': new Validator(
			'paymill-validate-cc-expdate-month',
			getValueIfExist('.paymill-payment-error-expdate'),
			function(v) {
				return paymill.validateExpiry(pmQuery('#paymill_creditcard_expiry_month').val(), pmQuery('#paymill_creditcard_expiry_year').val());
			},
			''
		),
		'paymill-validate-cc-expdate-year': new Validator(
			'paymill-validate-cc-expdate-year',
			getValueIfExist('.paymill-payment-error-expdate'),
			function(v) {
				return paymill.validateExpiry(pmQuery('#paymill_creditcard_expiry_month').val(), pmQuery('#paymill_creditcard_expiry_year').val());
			},
			''
		),
		'paymill-validate-cc-holder': new Validator(
			'paymill-validate-cc-holder',
			getValueIfExist('.paymill-payment-error-holder'),
			function(v) {
				return (paymill.validateHolder(v));
			},
			''
		),
		'paymill-validate-cc-cvc': new Validator(
			'paymill-validate-cc-cvc',
			getValueIfExist('.paymill-payment-error-cvc'),
			function(v) {
				if (paymill.cardType(pmQuery('#paymill_creditcard_number').val()).toLowerCase() === 'maestro') {
					return true;
				}

				return paymill.validateCvc(v);
			},
			''
		)
	};

	Object.extend(Validation.methods, nvCc);
	
	pmQuery('#paymill_directdebit_holdername').live('focus', function() {
		pmQuery('.paymill-info-fastCheckout-elv').val('false');
	});

	pmQuery('#paymill_directdebit_account').live('focus', function() {
		pmQuery('.paymill-info-fastCheckout-elv').val('false');
	});

	pmQuery('#paymill_directdebit_bankcode').live('focus', function() {
		pmQuery('.paymill-info-fastCheckout-elv').val('false');
	});

	pmQuery('#paymill_creditcard_holdername').live('focus', function() {
		pmQuery('.paymill-info-fastCheckout-cc').val('false');
	});

	pmQuery('#paymill_creditcard_cvc').live('focus', function() {
		pmQuery('.paymill-info-fastCheckout-cc').val('false');
	});

	pmQuery('#paymill_creditcard_number').live('focus', function() {
		pmQuery('.paymill-info-fastCheckout-cc').val('false');
	});

	pmQuery('#paymill_creditcard_expiry_month').live('change', function() {
		pmQuery('.paymill-info-fastCheckout-cc').val('false');
	});

	pmQuery('#paymill_creditcard_expiry_year').live('change', function() {
		pmQuery('.paymill-info-fastCheckout-cc').val('false');
	});

	pmQuery('#paymill_creditcard_number').live('input', paymillSubmitForm);
	pmQuery('#paymill_creditcard_cvc').live('input', paymillSubmitForm);
	pmQuery('#paymill_creditcard_expiry_month').live('change', paymillSubmitForm);
	pmQuery('#paymill_creditcard_expiry_year').live('change', paymillSubmitForm);
	pmQuery('#paymill_directdebit_bankcode').live('input', paymillSubmitForm);
	pmQuery('#paymill_creditcard_number').live('input', paymillShowCardIcon);
}