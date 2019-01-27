'use strict';

const {
  Builder,
  By,
  Key,
  until,
  Origin,
  logging
} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const assert = require('assert');
const argv = require('minimist')(process.argv.slice(2));

logging.installConsoleHandler();
logging.getLogger('webdriver.http').setLevel(logging.Level.SEVERE);

let ampTestConfig = {
  browser: 'chrome',
  searchKeyword: 'amp-list',
  expectedAmpViewerTitle: 'ampbyexample.com',
  targetSelector: 'a.amp_r',
};

const width = 500;
const height = 1000;
let loggerStep = 1;

function log(message) {
  console.log(`${loggerStep}: ${message}`);
  loggerStep++;
}

async function createDriver(browser) {
  let driver;
  try {
    switch(browser) {
      case 'firefox':
        let options = new firefox.Options()
            // .setPreference('devtools.responsive.html.displayedDeviceList',
            //   '{"added":["Nexus 5X"],"removed":[]}')
            .setPreference('devtools.responsive.userAgent',
              'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1')
            .setBinary(firefox.Channel.RELEASE);
        driver = new Builder()
          .forBrowser('firefox')
          .setFirefoxOptions(options)
          .build();
        break;

      case 'chrome':
      default:
        driver = new Builder()
        .forBrowser('chrome').setChromeOptions(
          new chrome.Options()
          .setMobileEmulation({
            deviceName: 'Pixel 2'
          }).windowSize({
            width,
            height
          }))
        .build();
        break;
    }
  } catch(err) {
    console.error(err);
  } finally {
    return driver;
  }
}

async function runGoogleSearchTest(config, context) {
  let driver;
  try {
    driver = await createDriver(config.browser);

    await driver.manage().window().setRect({
      width: width,
      height: height,
      x: 100,
      y: 0
    });

    const actions = driver.actions({
      bridge: true
    });

    log('Search...');
    await driver.sleep(2000);

    await driver.get('https://www.google.com/ncr');
    await driver.findElement(By.name('q')).sendKeys(config.searchKeyword, Key.RETURN);

    await driver.wait(until.titleIs(config.searchKeyword + ' - Google Search'), 3000);

    log('Received search results.');

    let body = await driver.wait(until.elementLocated(By.css('body')), 3000);
    let mainDom = await driver.wait(until.elementLocated(By.css('#tophf')), 3000);

    log('mainDom result found.');

    let targetDom = await driver.findElement(By.css(config.targetSelector));
    log('first amp result found.');

    assert.equal(await targetDom.getTagName(), 'a');
    assert.equal(await targetDom.getAttribute('class'), 'C8nzq BmP5tf amp_r');

    await targetDom.click();
    log('Clicked first AMP result.');

    await driver.sleep(2000);

    let ampViewerTitle = await driver.wait(until.elementLocated(By.css('.amp-ttltxt')), 3000);
    assert.equal(await ampViewerTitle.getText(), config.expectedAmpViewerTitle);
    log('Saw AMP viewer title: ' + await ampViewerTitle.getText());

    // Switch to first iframe.
    // driver.switchTo().frame(0);
    //
    // let ampContent = await driver.wait(until.elementLocated(By.css('img[alt="AMP by Example"]')), 3000);
    // log('Saw AMP by example content.');
    await driver.sleep(3000);

    log('Task Complete.');

  } catch (err) {
    console.error(err);

  } finally {
    if (driver && context.screenshot) {
      let image = await driver.takeScreenshot();
      require('fs').writeFileSync(`output/run-${context.run}.png`, image, 'base64');
      log('Screenshot took.');
    }
    await driver && driver.quit();
    log('Driver quit.');
  }
}

// Main test

async function main() {
  let succces = 0;
  let runs = argv['runs'] || 3;
  let results = [];

  for (let i = 1; i <= runs; i++) {
    try {
      loggerStep = 1;
      console.log(`------ Run ${i} ------`);
      await runGoogleSearchTest(ampTestConfig, {
        run: i,
        screenshot: true,
      });
      succces++;
      results.push('success');
    } catch (err) {
      console.error(err);
      results.push('failed');
    }
  }
  console.log('===========');
  console.log(`succces: ${succces}/${runs}`);

  for (let i = 0; i < runs; i++) {
    console.log(`${i+1}: ${results[i]}`);
  }
}

main();
