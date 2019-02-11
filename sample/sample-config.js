let sampleConfig = {
  browser: 'chrome',
  device: 'Pixel 2',
  windowWidth: 600,
  windowHeight: 900,
  sleepAfterEachStep: 1000,
  sleepAfterEachAction: 500,
  steps: [{
    name: 'Search amp-list on Google Search',
    outputHtmlToFile: true,
    actions: [{
      log: 'Search',
      actionType: 'url',
      url: 'https://www.google.com/ncr',
      sleepAfter: 1000,
    }, {
      log: 'Input search keyword',
      actionType: 'typeThenSubmit',
      selector: 'input[name="q"]',
      inputText: 'amp-list amp by example',
      sleepAfter: 1000,
    }, {
      log: 'Verify page title',
      actionType: 'assertPageTitle',
      matchRegex: 'amp-list amp by example - Google Search',
    }]
  }, {
    name: 'Click first AMP result in the SERP',
    outputHtmlToFile: true,
    actions: [{
      log: 'Click first AMP result',
      actionType: 'click',
      // For non-AMP results: 'div[data-hveid] a.BmP5tf'
      // For AMP results: 'div[data-hveid] a.amp_r'
      selector: 'div[data-hveid] a.amp_r',
    }, {
      log: 'Verify AMP viewer title',
      actionType: 'assertInnerText',
      selector: '.amp-ttlctr',
      matchRegex: '(ampproject.org|ampbyexample.com)',
      sleepAfter: 1000,
    // }, {
    //   log: 'Output iframe content',
    //   iframe: 1,
    //   actionType: 'outputContentToFile',
    //   selector: 'html',
    //   filename: 'iframe-1.html',
    }]
  }, {
    name: 'Click iframe',
    outputHtmlToFile: true,
    actions: [{
      log: 'Verify page header',
      iframe: 1,
      actionType: 'assertInnerText',
      selector: 'header.www-header > h1.mb1',
      matchRegex: 'amp-list',
    }, {
      log: 'Click Open In Playground button',
      iframe: 1,
      actionType: 'click',
      selector: 'a.ampstart-btn',
      sleepAfter: 1000,
    }, {
      log: 'Verify playground document-title',
      actionType: 'assertInnerText',
      selector: '#document-title',
      matchRegex: 'amp-list',
    }, {
      log: 'Take screenshot',
      actionType: 'screenshot',
      filename: 'step-final.png',
    }],
  }],
};

module.exports = sampleConfig;
