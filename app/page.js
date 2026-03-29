"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, Search, User } from "lucide-react";

export default function Home() {
  const [refNo, setRefNo] = useState("");
  const [savedBills, setSavedBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("mepco_saved_bills");
    if (stored) {
      try {
        setSavedBills(JSON.parse(stored));
      } catch (e) {
        setSavedBills([]);
      }
    }
  }, []);

  const saveToStorage = (bills) => {
    setSavedBills(bills);
    localStorage.setItem("mepco_saved_bills", JSON.stringify(bills));
  };

  // CLIENT SIDE SCRAPING FUNCTION!
  const scrapeBillDirectly = async (reference) => {
    const url = "https://bill.pitc.com.pk/mepcobill";
    
    // 1. Fetch ASP.NET tokens
    const getRes = await fetch(url, { method: "GET" });
    const htmlText = await getRes.text();
    
    const parser = new DOMParser();
    const getDoc = parser.parseFromString(htmlText, "text/html");
    
    const formData = new URLSearchParams();
    const hiddenInputs = getDoc.querySelectorAll('input[type="hidden"]');
    hiddenInputs.forEach((input) => {
      formData.append(input.name, input.value || "");
    });
    
    formData.append("searchTextBox", reference);
    formData.append("rbSearchByList", "refno");
    formData.append("ruCodeTextBox", "");
    formData.append("btnSearch", "Search");

    // 2. Fetch the bill via POST
    const postRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });
    
    const finalHtml = await postRes.text();
    const finalDoc = parser.parseFromString(finalHtml, "text/html");
    const rawText = finalDoc.body.textContent.replace(/\s+/g, " ");

    let amountWithin = "Not Found";
    let amountAfter = "Not Found";
    let dueDate = "Not Found";
    let consumerName = "Unknown";
    
    const nameMatch = rawText.match(/NAME & ADDRESS\s+([^|]+?)\s+[A-Z0-9]/i) || rawText.match(/NAME\s+([A-Z\s.-]+)(?:\s+ADDRESS)/i);
    if(nameMatch) consumerName = nameMatch[1].trim();

    const matchWithin = rawText.match(/PAYABLE WITHIN DUE DATE\s*([\d,]+)/);
    if (matchWithin) amountWithin = matchWithin[1];

    const matchAfter = rawText.match(/([\d,]+)\s*PAYABLE AFTER DUE DATE/);
    if (matchAfter) amountAfter = matchAfter[1];

    const matchDate = rawText.match(/DUE DATE(?:[^]+?){4,8}?(\d{2}\s+[A-Za-z]{3}\s+\d{2})/);
    if (matchDate) {
      dueDate = matchDate[1];
    } else {
      const dates = rawText.match(/\d{2}\s+[A-Za-z]{3}\s+\d{2}/g);
      if (dates && dates.length > 0) dueDate = dates[dates.length - 1];
    }
    
    // Explicit Dom Traversal Fallback
    if (consumerName === "Unknown") {
      const tds = Array.from(finalDoc.querySelectorAll('td'));
      for (let i=0; i < tds.length; i++) {
        if (tds[i].textContent.trim().toUpperCase().includes("NAME & ADDRESS")) {
           consumerName = tds[i+1]?.textContent.trim().split('\n')[0] || "Unknown";
           break;
        }
      }
    }

    return {
      refNo: reference,
      name: consumerName,
      dueDate,
      amountWithin,
      amountAfter,
      fetchedAt: new Date().toISOString()
    };
  };

  const fetchSingleBill = async (reference, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    try {
      // Execute local Javascript scraping directly bridging through Vercel Client
      const data = await scrapeBillDirectly(reference);
      
      setSavedBills(prev => {
        const existing = prev.filter(b => b.refNo !== reference);
        const updated = [{ ...data }, ...existing];
        saveToStorage(updated);
        return updated;
      });
      return data;
    } catch (err) {
      if (!isBackground) setError("Failed to bridge connection to MEPCO locally: " + err.message);
      return null;
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (refNo.length !== 14) {
      setError("Reference number must be exactly 14 digits.");
      return;
    }
    fetchSingleBill(refNo);
    setRefNo("");
  };

  const handleRefreshAll = async () => {
    if (savedBills.length === 0) return;
    setRefreshingAll(true);
    await Promise.allSettled(savedBills.map(bill => fetchSingleBill(bill.refNo, true)));
    setRefreshingAll(false);
  };

  const deleteBill = (reference) => {
    const updated = savedBills.filter(b => b.refNo !== reference);
    saveToStorage(updated);
  };

  return (
    <main className="min-h-screen pb-20 pt-8 px-5 mx-auto max-w-md antialiased text-gray-800">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight text-emerald-600 mb-1 flex items-center justify-center">
           MEPCO
        </h1>
        <p className="text-gray-500 font-medium tracking-wide">Instant Electricity Bill Checker</p>
      </div>

      <form onSubmit={handleSearch} className="mb-8 relative shadow-sm">
        <input
          type="number"
          value={refNo}
          onChange={(e) => setRefNo(e.target.value)}
          placeholder="Enter 14-Digit Reference No"
          className="w-full text-lg p-4 pl-5 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all pr-16 bg-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 bg-emerald-500 text-white rounded-xl px-4 hover:bg-emerald-600 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin h-6 w-6" /> : <Search className="h-6 w-6" />}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm text-center border border-red-100 shadow-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-5 mt-10">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Recent Bills</h2>
        {savedBills.length > 0 && (
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:bg-emerald-100 bg-emerald-50 px-4 py-2 rounded-full transition-colors active:scale-95 disabled:opacity-50 border border-emerald-100"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingAll ? "animate-spin" : ""}`} />
            {refreshingAll ? "Updating..." : "Update All"}
          </button>
        )}
      </div>

      {savedBills.length === 0 ? (
        <div className="text-center text-gray-400 py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <p className="font-semibold text-lg text-gray-400">No saved bills yet.</p>
          <p className="text-sm mt-1 px-8">Search for your bill above and it will show up here automatically.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {savedBills.map((bill) => (
            <div key={bill.refNo} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-emerald-200 transition-colors">
              <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                <div onClick={() => fetchSingleBill(bill.refNo)} className="cursor-pointer flex items-start gap-3 w-full">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                     <User className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="pr-4">
                    <h3 className="font-black text-gray-800 text-lg leading-tight line-clamp-2">
                       {bill.name !== "Unknown" ? bill.name : `Account`}
                    </h3>
                    <p className="text-sm text-gray-400 font-mono tracking-wide mt-0.5">{bill.refNo}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => deleteBill(bill.refNo)}
                  className="text-gray-300 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-2.5 rounded-full transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div 
                className="grid grid-cols-2 gap-x-5 gap-y-4 cursor-pointer active:opacity-70 transition-opacity"
                onClick={() => fetchSingleBill(bill.refNo)}
              >
                <div>
                  <p className="text-xs text-emerald-600/80 mb-0.5 uppercase tracking-widest font-bold">Due Date</p>
                  <p className="font-extrabold text-gray-800 text-xl">{bill.dueDate}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600/80 mb-0.5 uppercase tracking-widest font-bold">Payable</p>
                  <p className="font-black text-emerald-600 text-[26px] tracking-tighter leading-none">Rs. {bill.amountWithin || 0}</p>
                </div>
                
                {bill.amountAfter && bill.amountAfter !== "Not Found" && bill.amountAfter !== bill.amountWithin && (
                  <div className="col-span-2 pt-3 border-t border-gray-50 flex justify-between items-center rounded-b-xl bg-red-50/50 -mx-6 -mb-6 px-6 pb-6 pt-4 border-t-red-100">
                    <p className="text-xs text-red-500/80 font-bold uppercase tracking-widest">After Due Date</p>
                    <p className="font-black text-red-500 text-lg">Rs. {bill.amountAfter}</p>
                  </div>
                )}
              </div>
              
            </div>
          ))}
        </div>
      )}

    </main>
  );
}
