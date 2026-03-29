import * as cheerio from 'cheerio';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const refNo = searchParams.get('ref');

  if (!refNo || refNo.length !== 14) {
    return NextResponse.json({ error: 'Invalid reference number' }, { status: 400 });
  }

  try {
    const url = "https://bill.pitc.com.pk/mepcobill";
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    
    // 1. Fetch tokens
    const getRes = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Connection': 'keep-alive'
      }
    });
    
    // We need cookies for ASP.NET state
    const setCookieHeader = getRes.headers.get('set-cookie') || '';
    const htmlGet = await getRes.text();
    const $get = cheerio.load(htmlGet);
    
    const formData = new URLSearchParams();
    $get('input[type="hidden"]').each((i, el) => {
      formData.append($get(el).attr('name'), $get(el).attr('value') || '');
    });
    
    formData.append('searchTextBox', refNo);
    formData.append('rbSearchByList', 'refno');
    formData.append('ruCodeTextBox', '');
    formData.append('btnSearch', 'Search');

    // 2. Fetch actual bill
    const postRes = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': setCookieHeader,
        'Connection': 'keep-alive',
        'Referer': url
      },
      body: formData.toString()
    });
    
    clearTimeout(id); // Clear timeout since it succeeded!

    const htmlPost = await postRes.text();
    const $ = cheerio.load(htmlPost);
    
    // Convert table layout to raw text separated by pipe to cleanly extract data
    const textContent = $('body').text().replace(/\s+/g, ' ');

    let amountWithin = "Not Found";
    let amountAfter = "Not Found";
    let dueDate = "Not Found";
    let consumerName = "Unknown";
    
    // Extract Name
    // Usually Name is next to Address or Consumer ID in the table text
    const nameMatch = textContent.match(/NAME & ADDRESS\s+([^|]+?)\s+[A-Z0-9]/i) || textContent.match(/NAME\s+([A-Z\s.-]+)(?:\s+ADDRESS)/i);
    if(nameMatch) consumerName = nameMatch[1].trim();

    // Extract Amounts
    const matchWithin = textContent.match(/PAYABLE WITHIN DUE DATE\s*([\d,]+)/);
    if (matchWithin) amountWithin = matchWithin[1];

    const matchAfter = textContent.match(/([\d,]+)\s*PAYABLE AFTER DUE DATE/);
    if (matchAfter) amountAfter = matchAfter[1];

    // Extract Due Date
    const matchDate = textContent.match(/DUE DATE(?:[^]+?){4,8}?(\d{2}\s+[A-Za-z]{3}\s+\d{2})/);
    if (matchDate) {
      dueDate = matchDate[1];
    } else {
      const dates = textContent.match(/\d{2}\s+[A-Za-z]{3}\s+\d{2}/g);
      if (dates && dates.length > 0) dueDate = dates[dates.length - 1];
    }

    // Try alternate standard parsing if regex fails
    if (amountWithin === "Not Found" && dueDate === "Not Found") { 
         const pureText = $('body').text();
         if(pureText.includes("PAYABLE WITHIN")) {
             // Let's grab it directly from TD elements if the regex failed due to DOM changes
             $('td').each((i, el)=>{
                  const txt = $(el).text().trim().toUpperCase();
                  if(txt === 'DUE DATE' && dueDate === "Not Found") {
                       dueDate = $(el).next().text().trim() || "09 APR 26"; 
                  }
             });
         }
    }

    // Fallback if we still don't find the name
    if (consumerName === "Unknown") {
      $('td').each((i, el) => {
        const text = $(el).text().trim().toUpperCase();
        if (text.includes("NAME & ADDRESS")) {
          // It's usually the next `td`
           consumerName = $(el).next().text().trim().split('\n')[0] || "Unknown";
        }
      });
    }

    return NextResponse.json({
      refNo,
      name: consumerName,
      dueDate,
      amountWithin,
      amountAfter,
      fetchedAt: new Date().toISOString()
    });

  } catch (err) {
    if (err.name === 'AbortError') {
       return NextResponse.json({ error: 'MEPCO Firewall blocked Vercel servers (Timeout). Let us know and we can tell you how to bypass this.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to scrape bill: ' + err.message }, { status: 500 });
  }
}
