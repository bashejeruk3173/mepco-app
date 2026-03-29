"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, Search, LightningBolt, User } from "lucide-react";

export default function Home() {
  const [refNo, setRefNo] = useState("");
  const [savedBills, setSavedBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load from local storage
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

  const fetchSingleBill = async (reference, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/bill?ref=${reference}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch");

      setSavedBills(prev => {
        const existing = prev.filter(b => b.refNo !== reference);
        const updated = [{ ...data, refNo: reference }, ...existing];
        localStorage.setItem("mepco_saved_bills", JSON.stringify(updated));
        return updated;
      });
      return data;
    } catch (err) {
      if (!isBackground) setError(err.message);
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
    // Fetch all in parallel
    await Promise.allSettled(savedBills.map(bill => fetchSingleBill(bill.refNo, true)));
    setRefreshingAll(false);
  };

  const deleteBill = (reference) => {
    const updated = savedBills.filter(b => b.refNo !== reference);
    saveToStorage(updated);
  };

  return (
    <main className="min-h-screen pb-20 pt-8 px-5 max-w-md mx-auto relative antialiased">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight text-emerald-600 mb-1 flex items-center justify-center">
           MEPCO
        </h1>
        <p className="text-gray-500 font-medium">Instant Electricity Bill Checker</p>
      </div>

      <form onSubmit={handleSearch} className="mb-8 relative">
        <input
          type="number"
          value={refNo}
          onChange={(e) => setRefNo(e.target.value)}
          placeholder="14-Digit Reference No"
          className="w-full text-lg p-4 pl-5 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all pr-16 shadow-sm bg-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 bg-emerald-500 text-white rounded-xl px-4 hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <RefreshCw className="animate-spin h-6 w-6" /> : <Search className="h-6 w-6" />}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm text-center border border-red-100 shadow-sm font-medium">
          {error}
        </div>
      )}

      {/* DASHBOARD LIST */}
      <div className="flex items-center justify-between mb-5 mt-10">
        <h2 className="text-xl font-bold text-gray-800">Recent Bills</h2>
        {savedBills.length > 0 && (
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:bg-emerald-100 bg-emerald-50 px-4 py-2 rounded-full transition-colors active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingAll ? "animate-spin" : ""}`} />
            {refreshingAll ? "Updating..." : "Update All"}
          </button>
        )}
      </div>

      {savedBills.length === 0 ? (
        <div className="text-center text-gray-400 py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
          <p className="font-medium">No saved bills yet.</p>
          <p className="text-sm mt-1">Search for a bill to save it automatically.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {savedBills.map((bill) => (
            <div key={bill.refNo} className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden group">
              
              {/* Card Header (Name + Ref + Delete) */}
              <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                <div onClick={() => fetchSingleBill(bill.refNo)} className="cursor-pointer flex items-start gap-2 max-w-[85%]">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                     <User className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 leading-tight line-clamp-2">
                       {bill.name !== "Unknown" ? bill.name : `REF: ${bill.refNo}`}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono tracking-tight mt-1">{bill.refNo}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => deleteBill(bill.refNo)}
                  className="text-gray-300 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-2 rounded-full transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Main Bill Data Grid */}
              <div 
                className="grid grid-cols-2 gap-5 cursor-pointer active:opacity-70 transition-opacity"
                onClick={() => fetchSingleBill(bill.refNo)}
              >
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Due Date</p>
                  <p className="font-bold text-gray-800 text-lg">{bill.dueDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Payable</p>
                  <p className="font-black text-emerald-600 text-2xl tracking-tight leading-none">Rs. {bill.amountWithin || 0}</p>
                </div>
                
                {/* After due row visible only if valid */}
                {bill.amountAfter && bill.amountAfter !== "Not Found" && bill.amountAfter !== bill.amountWithin && (
                  <div className="col-span-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                    <p className="text-xs text-gray-500 font-medium">After Due Date:</p>
                    <p className="font-bold text-red-500">Rs. {bill.amountAfter}</p>
                  </div>
                )}
              </div>
              
              <div className="text-[10px] text-gray-400 mt-4 text-right pt-3">
                Updated: {new Date(bill.fetchedAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </main>
  );
}
