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

/*
actions:
  URL
  InputThenEnter

*/
let taskConfig = {
  browser: 'chrome',
  searchKeyword: 'amp-list',
  expectedAmpViewerTitle: 'ampbyexample.com',
  targetSelector: 'a.amp_r',
  screenshot: true,
  width: 500,
  height: 1000,
  sleepAfterEachStep: 1000,
  steps: [{
    action: 'URL',
    log: 'Search',
    url: 'https://www.google.com/ncr',
  }, {
    action: 'InputThenEnter',
    log: 'Input search keyword',
    cssSelector: 'input[name="q"]',
    inputText: 'amp-list',
    sleepAfter: 0,
  }, {
    action: 'VerifyTitle',
    log: 'Verify page title',
    textEqualsTo: 'amp-list - Google Search',
  }, {
    action: 'Click',
    log: 'Click first AMP result',
    cssSelector: 'a.amp_r',
  }, {
    action: 'VerifyText',
    log: 'Verify AMP viewer title',
    cssSelector: '.amp-ttltxt',
    textEqualsTo: 'ampbyexample.com',
  }, {
    action: 'SwitchIframe',
    iframeId: 0, // iframe number or 'id'
  }, {
    action: 'Click',
    log: 'Click Open In Playground button',
    cssSelector: 'a.ampstart-btn',
  }, {
    action: 'VerifyText',
    log: 'Verify document title',
    cssSelector: '#document-title',
    textEqualsTo: 'amp-list',
  }, {
    action: 'Screenshot',
    log: 'Screenshot.',
    outputFolder: 'output',
    suffix: 'End',
  }],
};

let loggerStep = 1;

function log(message) {
  console.log(`${loggerStep}: ${message}`);
  loggerStep++;
}

function printUsage() {
  let usage = `
Usage: node main.js

Options:
  --runs=NUM_OF_RUNS\tNumber of test runs.
  --output=FILE\t\tPath to the output file.
  --config=FILE\t\tPath to the task config in JSON format.
  `;
  console.log(usage);
}

async function createDriver(config) {
  let driver;
  try {
    switch (config.browser) {
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
              width: config.width,
              height: config.height
            }))
          .build();
        break;
    }

    await driver.manage().window().setRect({
      width: config.width,
      height: config.height,
      x: 100,
      y: 0
    });

  } catch (err) {
    console.error(err);
  } finally {
    return driver;
  }
}

async function runTask(config, context) {
  let driver;
  try {
    assert(config.steps);

    driver = await createDriver(config);
    const actions = driver.actions({
      bridge: true
    });
    await driver.sleep(2000);

    for (var i = 0; i < config.steps.length; i++) {
      let step = config.steps[i];
      let targetDom;
      log(step.log || 'No log.');
      switch (step.action) {
        case 'URL':
          await driver.get(step.url);
          break;
        case 'InputThenEnter':
          await driver
            .findElement(By.css(step.cssSelector))
            .sendKeys(step.inputText, Key.RETURN);
          break;
        case 'Click':
          targetDom = await driver.findElement(By.css(step.cssSelector));
          await targetDom.click();
          break;
        case 'VerifyTitle':
          await driver.wait(until.titleIs(step.textEqualsTo), 3000);
          break;
        case 'VerifyText':
          targetDom = await driver.wait(until.elementLocated(By.css(step.cssSelector)), 3000);
          assert.equal(await targetDom.getText(), step.textEqualsTo);
          break;
        case 'SwitchIframe':
          await driver.switchTo().frame(step.iframeId);
          break;
        case 'Screenshot':
          let image = await driver.takeScreenshot();
          require('fs').writeFileSync(
            `${step.outputFolder}/screenshot-RUN_${context.run}-${step.suffix}.png`,
            image, 'base64');
          break;
        default:
          throw new Error(`action ${step.action} is not supported.`);
          break;
      }
      if (step.sleepAfter) {
        await driver.sleep(step.sleepAfter);
      }
      if (config.sleepAfterEachStep) {
        await driver.sleep(config.sleepAfterEachStep);
      }
    }
  } catch (err) {
    console.error(err);

  } finally {
    await driver && driver.quit();
    log('Complete.');
  }
}

// Main
async function main() {
  let succces = 0;
  let runs = argv['runs'] || 3;
  let report = argv['report'];
  let results = [];

  if (!runs) {
    printUsage();
    return;
  }

  for (let i = 1; i <= runs; i++) {
    try {
      loggerStep = 1;
      console.log(`------ Run ${i} ------`);
      await runTask(taskConfig, {
        run: i,
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
