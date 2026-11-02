export const isAllowedVendorUrl = (url: string): boolean => {
    try {
       const parsedUrl = new URL(url);

       if (parsedUrl.username !== '' || parsedUrl.password !== '') {
            return false;
        }
        else {
            return parsedUrl.origin === 'https://summit-trail-utility-demo.vercel.app';
        }

    }

    catch {
        return false;
    }

}
