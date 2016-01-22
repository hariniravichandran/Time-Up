var console = chrome.extension.getBackgroundPage().console;
var app = {
	timerData: {},
	init: function () {
		var submitBtn = document.getElementById('submitButton');
	    submitBtn.addEventListener('click', function() {
	    	var timeLimit = document.getElementById('timeLimit').value;
	        var site = document.getElementById('siteSelector').value;
	        var timerData = {
	        	'site': site.toLowerCase().trim(),
	        	'timeLimit': parseInt(timeLimit)
	        };
	        chrome.runtime.sendMessage(timerData, function (response) {
	        	console.log(response);
	        });
	    });
	    
	    var msg = "Send Data";
	    chrome.runtime.sendMessage({msg: "Send Data"}, function (response){
	    	console.log (response)
	    });
	}
};

document.addEventListener('DOMContentLoaded', function(){
	app.init();
});

