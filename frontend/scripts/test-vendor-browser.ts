import {chromium} from 'playwright';
import {isAllowedVendorUrl} from '../lib/payments/vendor-url';

async function testVendorBrowser() {
    const testUrl = 'https://summit-trail-utility-demo.vercel.app';

    if (!isAllowedVendorUrl(testUrl)) {
        console.error("The test URL is not allowed.");
        process.exitCode = 1;
        return;
    }

    const browser = await chromium.launch({ headless: false })

    try {
        const page = await browser.newPage();
        await page.goto(testUrl, {
            timeout: 15000,
            waitUntil: 'domcontentloaded'
        });

        await page.getByRole('heading', { name: 'The right equipment for the job.', exact: true }).waitFor({ state: 'visible', timeout: 15000 });

        console.log(await page.title());
        const pageText = await page.locator('body').innerText()
        console.log("Page text content:", pageText);

    }
    catch (error) {
        console.error("Error occurred while testing vendor browser:", error);
        process.exitCode = 1;
    }


    finally {
        await browser.close();
    }



}


testVendorBrowser().catch(error => {
    console.error("Error occurred while testing vendor browser:", error);
    process.exitCode = 1;
});
