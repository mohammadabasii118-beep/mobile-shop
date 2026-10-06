/* Edit this file: store settings, products and categories.
   price/old are in Toman (integers). stock 0 = sold out, <=5 = low stock.
   badge: 'new' | 'best' | 'promo'. art: id of an SVG <symbol> in index.html
   (replace with real photos later: see README). */
var P=[
 {id:1,name:'قاب سیلیکونی MagSafe مخصوص iPhone 15 Pro',brand:'Apple',cat:'case',art:'p-case',price:1490000,rating:4.8,n:214,stock:42,badge:'best',sw:['#e8dcc9','#1d1e22','#3b5b8c']},
 {id:2,name:'کابل USB-C به USB-C شارژ سریع ۱٫۵ متر',brand:'Anker',cat:'cable',art:'p-cable',price:420000,rating:4.7,n:389,stock:120},
 {id:3,name:'شارژر دیواری ۶۵ وات GaN مدل Nano II',brand:'Anker',cat:'charger',art:'p-charger',price:1790000,old:2390000,rating:4.9,n:512,stock:18,badge:'new'},
 {id:4,name:'پاوربانک ۲۰٬۰۰۰ میلی‌آمپر ساعت ۶۵ وات',brand:'Baseus',cat:'bank',art:'p-bank',price:2650000,old:3150000,rating:4.6,n:176,stock:3},
 {id:5,name:'هندزفری بی‌سیم Galaxy Buds FE با نویزکنسلینگ',brand:'Samsung',cat:'buds',art:'p-buds',price:4290000,rating:4.5,n:98,stock:25,badge:'new'},
 {id:6,name:'گلس آنتی‌استاتیک تمام‌صفحه Galaxy S24 Ultra',brand:'Samsung',cat:'glass',art:'p-glass',price:260000,old:340000,rating:4.7,n:301,stock:0},
 {id:7,name:'هولدر مگنتی خودرو دریچه‌ای مدل Orbit',brand:'Baseus',cat:'holder',art:'p-holder',price:590000,old:690000,rating:4.4,n:64,stock:60,badge:'promo'},
 {id:8,name:'فلش مموری ۱۲۸ گیگابایت USB 3.2',brand:'SanDisk',cat:'flash',art:'p-flash',price:880000,rating:4.8,n:240,stock:77}
];
var CATS=[['case','قاب و کاور'],['glass','گلس و محافظ'],['cable','کابل و مبدل'],['charger','شارژر'],['bank','پاوربانک'],['buds','هندزفری'],['holder','هولدر'],['flash','فلش و حافظه']];
var ART={case:'p-case',glass:'p-glass',cable:'p-cable',charger:'p-charger',bank:'p-bank',buds:'p-buds',holder:'p-holder',flash:'p-flash'};
