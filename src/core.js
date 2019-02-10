const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const argv = require('minimist')(process.argv.slice(2));
const assert = require('assert');
const { JSDOM } = require("jsdom");


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
      actionType: 'typeThenSubmit',
      log: 'Input search keyword',
      selector: 'input[name="q"]',
      inputText: 'amp-list',
      sleepAfter: 1000,
    }, {
      actionType: 'verifyTitle',
      log: 'Verify page title',
      textEqualsTo: 'amp-list - Google Search',
    }]
  }, {
    name: 'Click first AMP result in the SERP',
    outputHtmlToFile: true,
    actions: [{
      actionType: 'click',
      log: 'Click first AMP result',
      selector: 'a.amp_r',
    }, {
      actionType: 'verifyText',
      log: 'Verify AMP viewer title',
      selector: '.amp-ttlctr',
      textEqualsTo: 'ampbyexample.com',
    }, {
      actionType: 'click',
      log: 'Click Open In Playground button',
      selector: 'a.ampstart-btn',
    }, {
      actionType: 'verifyText',
      log: 'Verify document title',
      selector: '#document-title',
      textEqualsTo: 'amp-list',
    }, {
      actionType: 'screenshot',
      log: 'Take screenshot',
      suffix: 'End',
    }],
  }],
};


async function runTask(config, context) {
  let isSuccess = false;
  let browser, page;
  let fullOutputPath = context.fullOutputPath;
  let device = config.device || 'Pixel 2'

  try {
    assert(config.browser);
    assert(config.steps);

    console.log(`Use device ${device}`.yellow);

    // Init puppeteer.
    browser = await puppeteer.launch({
      headless: context.isHeadless,
      args: [`--window-size=${config.windowWidth},${config.windowHeight}`],
    });
    page = await browser.newPage();
    await page.emulate(devices[device]);
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    for (var i = 0; i < config.steps.length; i++) {
      let step = config.steps[i];
      let isFailed = false;

      if (!step.actions || step.skip) continue;
      console.log(`Step ${i+1}: ${step.name}`.yellow);

      for (let [index, action] of Object.entries(step.actions)) {
        let message = action.actionType;
        console.log(`    action: ${action.actionType}`.blue);

        switch (action.actionType) {
          case 'url':
            await page.goto(action.url);
            message = 'Opened URL ' + action.url;
            break;

          case 'waitInSeconds':
            await page.waitFor(parseInt(action.value));
            message = `Waited for ${action.value} seconds`;
            break;

          case 'waitFor':
            await page.waitFor(action.selector);
            message = `Waited for element ${action.selector}`;
            break;

          case 'typeThenSubmit':
            await page.waitFor(action.selector);
            await page.type(action.selector, action.inputText);
            await page.keyboard.press('Enter');
            message = `Typed in element ${action.selector} with ${action.inputText}`;
            break;

          case 'click':
            await page.waitFor(action.selector);
            await page.click(action.selector);
            message = `Clicked element ${action.selector}`;
            break;

          case 'verifyTitle':
            let pageTitle = await page.title();
            if (pageTitle !== action.textEqualsTo) {
              throw new Error(`Page title "${pageTitle}" doesn't match ${action.textEqualsTo}`);
            } else {
              message = `Page title "${pageTitle}" matches ${action.textEqualsTo}`;
            }
            break;

          case 'verifyText':
            message = await page.evaluate((action, context) => {
              let el = document.querySelector(action.selector);
              if (!el) throw new Error(`No element found: ${action.selector}`);

              if (el.innerText !== action.textEqualsTo) {
                throw new Error(`Text doesn't match for element ${action.selector}: ${action.textEqualsTo}`);
              }
              return `Matched text for element ${action.selector}`;
            }, action, context);
            assert.equal(await targetDom.getText(), action.textEqualsTo);
            break;

          // case 'switchIframe':
          //   await driver.switchTo().frame(action.iframeId);
          //   break;

          case 'screenshot':
            await page.screenshot({
              path: `${fullOutputPath}/output-step-${i+1}-action-${index}.png`
            });
            break;

          case 'customFunc':
            if (action.customFunc) {
              await action.customFunc(action, page);
            }
            break;

          default:
            throw new Error(`action ${action.actionType} is not supported.`);
            break;
        }
        if (isFailed) throw new Error(`RunTask failed: ${message}`);
        if (action.sleepAfter) await page.waitFor(action.sleepAfter);
        if (config.sleepAfterEachAction) {
          await page.waitFor(config.sleepAfterEachAction);
        }

        console.log(`\t${action.log || action.actionType}: ${message}`.reset);
      }

      if (config.sleepAfterEachStep) {
        await page.waitFor(config.sleepAfterEachStep);
      }
      await page.screenshot({path: `${fullOutputPath}/step-${i+1}.png`});

      if (step.outputHtmlToFile) {
        await outputHtmlToFile(`${fullOutputPath}/html-step-${i+1}.html`, page);
      }
    }
    isSuccess = true;

  } catch (err) {
    console.error(`${err}`.red);
    await page.screenshot({path: `${fullOutputPath}/step-${i+1}.png`});
    await outputHtmlToFile(`${fullOutputPath}/html-step-${i+1}.html`, page);

  } finally {
    await browser.close();
    console.log('Complete.'.green);
    return isSuccess;
  }
}

async function outputHtmlToFile(filename, page) {
  // Output content
  let html = beautify(await page.content(), {
    indent_size: 2,
    preserve_newlines: false,
    content_unformatted: ['script', 'style'],
  });

  let filePath = path.resolve(filename);
  await fse.outputFile(filePath, html);
}

// Main
async function generateLoads(config, argv) {
  let succces = 0;
  let runs = argv['runs'] || 1;
  let outputPath = argv['output'] || Date.now;
  let results = [];
  let context = {
    verbose: argv.hasOwnProperty('verbose'),
    isHeadless: argv['headless'] ? argv['headless'] === 'true' : true,
  };

  if (!runs || !outputPath) {
    printUsage();
    return;
  }

  for (let i = 1; i <= runs; i++) {
    loggerStep = 1;
    context.run = i;
    context.fullOutputPath = `output/${outputPath}/run-${i}`;

    // Create a dummy file for the path.
    let filePath = path.resolve(`${context.fullOutputPath}/.dummy.txt`);
    await fse.outputFile(filePath, '');

    console.log(`------ Run ${i} ------`.yellow);
    let isSuccess = await runTask(sampleConfig, context);

    if (isSuccess) {
      succces++;
      results.push('success'.green);
    } else {
      results.push('failed'.red);
    }
  }
  console.log('===========');
  console.log(`succces: ${succces}/${runs}`);

  for (let i = 0; i < runs; i++) {
    console.log(`${i+1}: ${results[i]}`);
  }
}


module.exports = {
  generateLoads: generateLoads,
};
