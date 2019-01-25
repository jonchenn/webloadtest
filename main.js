'use strict';

const {
  Builder,
  By,
  Key,
  until,
  logging
} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

logging.installConsoleHandler();
logging.getLogger('webdriver.http').setLevel(logging.Level.SEVERE);

let ampTestConfig = {
  searchKeyword: 'amp by example',
  expectedAmpViewerTitle: 'ampbyexample.com',
};

const width = 500;
const height = 1000;

async function runGoogleSearchTest(config) {
  let driver;
  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(
        new chrome.Options().setMobileEmulation({
          deviceName: 'Nexus 5X'
        }).windowSize({
          width,
          height
        }))
      .build();

    console.log('Search...');

    await driver.get('http://www.google.com');
    await driver.findElement(By.name('q')).sendKeys(config.searchKeyword, Key.RETURN);
    await driver.wait(until.titleIs(config.searchKeyword + ' - Google Search'), 3000);
    console.log('Received search results.');

    // console.log('sleep 2000');
    // await driver.sleep(2000);

    console.log('Click on search input.');
    let searchInput = await driver.findElement(By.name('q'));
    await searchInput.click();

    // console.log('sleep 2000');
    // await driver.sleep(2000);

    let firstAmpResult = await driver.wait(until.elementLocated(By.css('#gsr a.amp_r')), 10000);
    console.log('Found first amp result.');

    console.log('tag:', await firstAmpResult.getTagName());
    console.log('class:', await firstAmpResult.getAttribute('class'));
    console.log('href:', await firstAmpResult.getAttribute('href'));
    console.log('text:', await firstAmpResult.getText());

    // console.log('sleep 2000');
    // await driver.sleep(2000);

    console.log('Click first AMP result.');
    await firstAmpResult.click();

    let ampViewerTitle = await driver.findElement(By.css('.amp-ttltxt'));
    await driver.wait(until.elementIsVisible(ampViewerTitle), 3000);

    console.log(await ampViewerTitle.getText());
    assert.equal(await ampViewerTitle.getText(), config.expectedAmpViewerTitle);

    await driver.sleep(1000);

  } finally {
    await driver && driver.quit();
  }
}

// Main test

async function main() {
  let succces = 0;
  let numTests = 10;
  for (let i = 0; i < numTests; i++) {
    try {
      console.log(`------ Round ${i} ------`);
      await runGoogleSearchTest(ampTestConfig);
      succces++;
    } catch (err) {
      console.error(err);
    }
  }
  console.log('===========');
  console.log(`succces: ${succces}/${numTests}`);
}

main();
