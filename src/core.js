const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');
const beautify = require('js-beautify').html;
const colors = require('colors');
const argv = require('minimist')(process.argv.slice(2));
const assert = require('assert');
const { JSDOM } = require("jsdom");


function getPageObject(page, action) {
  if (typeof action.iframe === 'number') {
    console.log(`    On iframe #${action.iframe}`.yellow);
    return page.frames()[action.iframe];
  } else if (typeof action.iframe === 'string') {
    console.log(`    On iframe id = ${action.iframe}`.yellow);
    return page.frames().find(frame => frame.name() === action.iframe);
  }
  return page;
}

async function runTask(config, context) {
  let isSuccess = false, error = null;
  let browser, page, content;
  let fullOutputPath = context.fullOutputPath;
  let device = config.device || 'Pixel 2'
  let waitOptions = {
    waitUntil: ['load', 'networkidle0'],
  };

  try {
    assert(config.browser);
    assert(config.steps);

    console.log(`Use device ${device}`.cyan);

    // Init puppeteer.
    browser = await puppeteer.launch({
      headless: context.isHeadless,
      args: [`--window-size=${config.windowWidth},${config.windowHeight}`],
    });
    page = await browser.newPage();
    await page.emulate(devices[device]);
    page.on('console', msg => console.log(`\tPAGE console.log: ${msg.text()}`.gray));

    for (var i = 0; i < config.steps.length; i++) {
      let step = config.steps[i];
      let isFailed = false;

      if (!step.actions || step.skip) continue;
      console.log(`Step ${i+1}: ${step.name}`.cyan);

      for (let [index, action] of Object.entries(step.actions)) {
        let message = action.actionType;
        let pageObj = getPageObject(page, action);

        console.log(`    action: ${action.actionType}`.yellow);

        switch (action.actionType) {
          case 'url':
            await pageObj.goto(action.url);
            message = 'Opened URL ' + action.url;
            break;

          case 'waitInSeconds':
            await pageObj.waitFor(parseInt(action.value));
            message = `Waited for ${action.value} seconds`;
            break;

          case 'waitFor':
            await pageObj.waitFor(action.selector);
            message = `Waited for element ${action.selector}`;
            break;

          case 'typeThenSubmit':
            await pageObj.waitFor(action.selector);
            await pageObj.type(action.selector, action.inputText);
            await pageObj.keyboard.press('Enter');
            message = `Typed in element ${action.selector} with ${action.inputText}`;
            break;

          case 'click':
            await pageObj.waitFor(action.selector);
            await pageObj.click(action.selector),
            message = `Clicked element ${action.selector}`;
            break;

          case 'assertPageTitle':
            let pageTitle = await pageObj.title();
            if (!action.matchRegex.match(pageTitle)) {
              throw new Error(`Page title "${pageTitle}" doesn't match ${action.matchRegex}`);
            }
            message = `Page title "${pageTitle}" matches ${action.matchRegex}`;
            break;

          case 'assertInnerText':
            content = await pageObj.$eval(action.selector, el => el.innerText);
            if (!action.matchRegex.match(content)) {
              throw new Error(`Expect element ${action.selector} to match ` +
                `title as "${action.matchRegex}", but got "${content}".`);
            }
            message = `Matched text for element ${action.selector}`;
            break;

          case 'screenshot':
            await page.screenshot({
              path: `${fullOutputPath}/${action.filename}`
            });
            message = `Screenshot saved to ${action.filename}`;
            break;

          case 'outputContentToFile':
            content = await pageObj.$eval(action.selector, el => el.outerHTML);
            await outputHtmlToFile(
                `${fullOutputPath}/${action.filename}`, content);
            message = `write ${action.selector} to ${action.filename}`;
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
        await outputHtmlToFile(
            `${fullOutputPath}/html-step-${i+1}.html`,
            await page.content());
      }
    }

  } catch (err) {
    console.error(`${err}`.red);
    await page.screenshot({path: `${fullOutputPath}/step-${i+1}.png`});
    await outputHtmlToFile(
        `${fullOutputPath}/html-step-${i+1}.html`,
        await page.content());
    error = err;

  } finally {
    await browser.close();
    console.log('Complete.'.green);
    return error;
  }
}

async function outputHtmlToFile(filename, content) {
  // Output content
  let html = beautify(content, {
    indent_size: 2,
    preserve_newlines: false,
    content_unformatted: ['script', 'style'],
  });

  let filePath = path.resolve(filename);
  await fse.outputFile(filePath, html);
}

// Main
async function generateLoads(config, argv) {
  assert(config);

  let succces = 0;
  let runs = argv['runs'] || 1;
  let outputPath = argv['output'] || Date.now;
  let successes = [], results = [];
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

    console.log(`------ Run ${i} ------`.cyan);
    let error = await runTask(config, context);

    if (!error) {
      succces++;
      results.push('Success');
      successes.push(true);
    } else {
      results.push(`Error: ${error}`);
      successes.push(false);
    }
  }

  let successRate = Math.round(succces / runs * 100);
  let reportText = `succces: ${succces}/${runs} (${successRate}%)\r\n`;
  console.log('===========');
  console.log(reportText.cyan);

  for (let i = 0; i < runs; i++) {
    console.log(`${i+1}. ` + (successes[i] ? `${results[i]}`.green : `${results[i]}`.red));
    reportText += `${i+1}. ${results[i]}\r\n`;
  }

  // Output report to file.
  let filePath = path.resolve(`output/${outputPath}/report.txt`);
  await fse.outputFile(filePath, reportText);
}

module.exports = {
  generateLoads: generateLoads,
};
