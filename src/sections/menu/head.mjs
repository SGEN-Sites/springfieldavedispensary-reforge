// head.mjs — extra <head> for the menu pages: warm the connection to Dutchie before menu.js inserts its embed script
// (the script is requested from dutchie.com and answered from api.dutchie.com — audit/pages/shop/harvest.json requests).
export const MENU_HEAD = `<link rel="preconnect" href="https://dutchie.com">
<link rel="preconnect" href="https://api.dutchie.com">`;
