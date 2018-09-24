'use strict'

const https = require('https');
const fs = require('fs');
const Nightmare = require('nightmare');
const amazon_url = 'https://www.amazon.com/gp/your-account/order-history?opt=ab&digitalOrders=1&unifiedOrders=1&returnTo=&orderFilter=year-2017';
require('nightmare-inline-download')(Nightmare);

if (!process.env["AMAZON_ACCOUNT"] || !process.env["AMAZON_PASSWORD"])
	return console.error("please set AMAZON_ACCOUNT and AMAZON_PASSWORD");

// CONFIG
const amazon_email = process.env["AMAZON_ACCOUNT"];
const amazon_password = process.env["AMAZON_PASSWORD"];
const page_number = 1;
const mail_bill_comment = "Message automatique; Pouvez-vous m'envoyer une facture, merci.";
const bill_path = '/tmp/bills';

function co_slow_download(page, count, path) {
  const nightmare = Nightmare({ show: true,
  executionTimeout: 180 });
  var orderPage = nightmare
    .goto(page)
    .type('#ap_email', amazon_email)
    .type('#ap_password', amazon_password)
    .click('#signInSubmit-input')
    .download(path)
    .end()
    .then(console.log)
    .catch(function (err) {console.error(page, err);});
}

function slow_download(page, count, path) {
  var file = fs.createWriteStream(path);
  var request = https.get(page, function(response) {
    response.pipe(file);
  });
  file.on('error', (err) => {
    console.error(page, err);
  });
}
function step2(nightmare, page, l) {
  var count = 0;

  page.dl.forEach(function (d) {
    var url = `${bill_path}/bill-${l}-${count}.pdf`;
    setTimeout(function () {
      co_slow_download(d, count, url);
    }, 1000 * count);
    count++;
  });

  page.gi.forEach(function (d) {
    var url = `${bill_path}/bill-${l}-${count}.pdf`;
    setTimeout(function () {
      slow_download(d, count, url);
    }, 1000 * count);
    count++;
  });

/*
  page.co.forEach(function (d) {
    const nightmare = Nightmare({ show: true });
    var orderPage = nightmare
      .goto(d)
      .type('#ap_email', amazon_email)
      .type('#ap_password', amazon_password)
      .click('#signInSubmit')
    //    nightmare = nightmare.goto(d)
      .wait('span.a-dropdown-prompt')
      .click('input.a-button-input')
      .wait('#comment')
      .type('#comment', mail_bill_comment)
      .click('input.a-button-input')
      .wait('.a-box-inner a-alert-container')
      .html(`page-${count}.html`)
      .end()
      .then(console.log)
      .catch(function (err) {console.error(d, err)});
    count++;
  });
*/
  return nightmare;
}

function step1(l) {

  const nightmare = Nightmare({ show: true });
  var orderPage = nightmare
    .goto(amazon_url)
    .type('#ap_email', amazon_email)
    .wait(500)
//    .type('#ap_password', amazon_password)
    .click('input#continue')
    .wait('#signInSubmit')
    .type('#ap_password', amazon_password)
    .click('#signInSubmit')
    .wait('#yourOrdersContent')
    .wait('span.a-declarative');

  for (var ll = l ; ll-- > 0; ) {
    orderPage = orderPage.click('.a-last a')
      .wait('#yourOrdersContent');
  }

  for (var i = 2 ; i <= 5 ; ++i)
  {
    if (i == 4) { ++i }
    orderPage = orderPage
      .click(`#ordersContainer > div:nth-child(${i}) ul.a-unordered-list.a-nostyle.a-vertical .a-popover-trigger.a-declarative`)
      .wait(4000);
  }
  orderPage
    .wait('div.a-popover-inner')
    .evaluate(function () {
      var res = [];
      var dl = [];
      var gi = [];
      var co = [];
      var err = [];
      var tab = document.querySelectorAll('.a-popover-inner a.a-link-normal');
      tab.forEach(function (link) {res.push(link.href);});
      res.forEach(function (url) {
        if (url.search("download.html") >= 0) {
          dl.push(url);
        } else if (url.search("generated_invoices") >= 0) {
          gi.push(url);
        } else if (url.search("contact.html")>=0) {
          co.push(url);
        } else {
          err.push(url);
        }
      });
      return {dl:dl, gi:gi, co:co, err:err};
    })
    .then(function (page) {
      console.log(page);
      fs.writeFile(`./page-${l}.json`, JSON.stringify(page), console.log);
      return step2(nightmare, page, l);
    })
    .then(function(res) {console.log("ok" + res)})
    .catch((error) => {
      console.error('Search failed:', error);
    });
}

for (var l = 0; l < page_number ; ++l) {
  step1(l);
}
