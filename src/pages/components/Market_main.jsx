import React, { useEffect, useRef, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "../../API/axios";
import { toast } from "react-toastify";

// Calcula el saldo real del usuario a partir de sus transacciones de fondo
const calcBalance = (funds, email) => {
  let balance = 0;
  funds
    .filter(f => f.sender === email)
    .forEach(f => {
      if (f.Format === "fund" && f.Type === "success") balance += parseFloat(f.amount);
      if (f.Format === "withdraw" && f.Type === "success") balance -= parseFloat(f.amount);
    });
  return balance;
};

const Market_main = () => {
  const tvChartContainer = useRef();
  const tvTickerContainer = useRef();

  const [token] = useState(JSON.parse(localStorage.getItem("auth")) || "");
  const decoded = jwtDecode(token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  // ticker en formato EXCHANGE:SYMBOL
  const [ticker, setTicker] = useState("NASDAQ:AAPL");
  const [tickerInput, setTickerInput] = useState("NASDAQ:AAPL");

  // precio de mercado obtenido via Yahoo Finance (proxy público)
  const [marketPrice, setMarketPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ change: 0, changePct: 0 });
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");

  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("B");
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // ─── Fetch saldo del usuario ───────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    try {
      setBalanceLoading(true);
      const res = await axios.get("/api/v1/getFund_history");
      setUserBalance(calcBalance(res.data.fund, decoded.email));
    } catch (e) {
      console.error("Error fetching balance", e);
    } finally {
      setBalanceLoading(false);
    }
  }, [decoded.email]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // ─── Fetch precio via backend (evita CORS) ────────────────────────────────
  const fetchPrice = useCallback(async (symbol) => {
    const sym = symbol.includes(":") ? symbol.split(":")[1] : symbol;
    setPriceLoading(true);
    setPriceError("");
    setMarketPrice(null);
    try {
      const res = await axios.get(`/api/v1/getMarketPrice/${sym}`);
      const { price, change, changePct } = res.data;
      setMarketPrice(price);
      setPriceChange({ change, changePct });
    } catch (e) {
      const msg = e.response?.data?.message || "Ticker no encontrado. Verificá el símbolo.";
      setPriceError(msg);
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice(ticker);
    // Actualizar precio cada 15 segundos (tiempo real)
    const interval = setInterval(() => fetchPrice(ticker), 15000);
    return () => clearInterval(interval);
  }, [ticker, fetchPrice]);

  // ─── Widget gráfico TradingView ────────────────────────────────────────────
  useEffect(() => {
    if (!tvChartContainer.current) return;
    tvChartContainer.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: "5",
      timezone: "Etc/UTC",
      theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
    });
    tvChartContainer.current.appendChild(script);
  }, [ticker]);

  // ─── Widget ticker en tiempo real (mini quote) ─────────────────────────────
  useEffect(() => {
    if (!tvTickerContainer.current) return;
    tvTickerContainer.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: ticker,
      width: "100%",
      colorTheme: document.body.classList.contains("dark-mode") ? "dark" : "light",
      isTransparent: true,
      locale: "en",
    });
    tvTickerContainer.current.appendChild(script);
  }, [ticker]);

  // ─── Búsqueda ──────────────────────────────────────────────────────────────
  const handleSearch = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t) setTicker(t);
  };

  // ─── Cálculos de orden ─────────────────────────────────────────────────────
  const totalCost = qty && marketPrice
    ? (parseFloat(qty) * marketPrice).toFixed(2)
    : "0.00";

  const insufficientFunds = orderType === "B" && parseFloat(totalCost) > userBalance;

  // ─── Ejecutar orden ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!qty || parseFloat(qty) <= 0) {
      toast.error("Ingresá una cantidad válida");
      return;
    }
    if (!marketPrice) {
      toast.error("No hay precio de mercado disponible. Verificá el ticker.");
      return;
    }
    if (insufficientFunds) {
      toast.error(`Fondos insuficientes. Tu saldo es $${userBalance.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/v1/createMarketOrder", {
        ticker: ticker.includes(":") ? ticker.split(":")[1] : ticker,
        qty: parseFloat(qty),
        price: marketPrice,
        type: orderType,
        sender: decoded.email,
      });

      toast.success(
        `${orderType === "B" ? "✅ Compra" : "🔴 Venta"} de ${qty} ${ticker.includes(":") ? ticker.split(":")[1] : ticker} a $${marketPrice} ejecutada`
      );
      setQty("");
      // Refetch saldo real desde el servidor
      await fetchBalance();
    } catch (err) {
      const msg = err.response?.data?.message || "Error al procesar la orden";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const symbolLabel = ticker.includes(":") ? ticker.split(":")[1] : ticker;

  return (
    <div className="container-fluid mt-3 contenedor-padre-mercado-grafico" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div className="row mb-3 align-items-center">
        <div className="col">
          <h4 className="fw-bold text-primary mb-0">Market</h4>
          <small className="text-muted">Operá en tiempo real</small>
        </div>
        <div className="col-auto">
          {balanceLoading ? (
            <span className="badge bg-secondary fs-6">Cargando saldo...</span>
          ) : (
            <span className="badge bg-success fs-6">
              💰 Saldo: ${userBalance.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <input
              type="text"
              className="form-control"
              placeholder="Ej: NASDAQ:AAPL, NYSE:TSLA, BINANCE:BTCUSDT"
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              style={{ maxWidth: "380px" }}
            />
            <button className="btn btn-primary" onClick={handleSearch}>
              Buscar
            </button>
            <span className="text-muted small">
              Ticker actual: <strong>{ticker}</strong>
            </span>
          </div>
          <small className="text-muted d-block mt-1">
            Formato: EXCHANGE:TICKER — ej: <code>NASDAQ:AAPL</code>, <code>NYSE:MSFT</code>, <code>BINANCE:BTCUSDT</code>, <code>FX:EURUSD</code>
          </small>
        </div>
      </div>

      {/* Mini quote widget TradingView */}
      <div className="mb-2 bloque-mercado-vista" ref={tvTickerContainer} style={{
    height: "60px",
    width: "100%",
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  }} />

      <div className="row">
        {/* Gráfico */}
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body p-0" style={{ height: "480px" }}>
              <div
                ref={tvChartContainer}
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Panel de orden */}
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Ejecutar Orden</h5>
              <small className="opacity-75">{ticker}</small>
            </div>
            <div className="card-body">

              {/* Precio en tiempo real */}
              <div className="alert alert-info py-2 mb-3 text-center">
                {priceLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2" />Obteniendo precio...</>
                ) : priceError ? (
                  <span className="text-danger small">{priceError}</span>
                ) : marketPrice ? (
                  <>
                    <strong className="fs-5">${marketPrice.toLocaleString()}</strong>
                    <span className={"ms-2 small fw-bold " + (priceChange.change >= 0 ? "text-success" : "text-danger")}>
                      {priceChange.change >= 0 ? "+" : ""}{priceChange.change} ({priceChange.changePct}%)
                    </span>
                    <button
                      className="btn btn-sm btn-outline-secondary ms-2 py-0"
                      onClick={() => fetchPrice(ticker)}
                      title="Actualizar precio"
                    >
                      ↻
                    </button>
                  </>
                ) : (
                  <span className="text-muted small">Sin precio</span>
                )}
              </div>

              {/* Buy / Sell */}
              <div className="btn-group w-100 mb-3" role="group">
                <button
                  type="button"
                  className={`btn ${orderType === "B" ? "btn-success" : "btn-outline-success"}`}
                  onClick={() => setOrderType("B")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className={`btn ${orderType === "S" ? "btn-danger" : "btn-outline-danger"}`}
                  onClick={() => setOrderType("S")}
                >
                  Sell
                </button>
              </div>

              {/* Cantidad */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Cantidad de {symbolLabel}</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Ej: 10"
                  min="0.0001"
                  step="any"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>

              {/* Resumen */}
              <div className={`alert py-2 mb-3 ${insufficientFunds ? "alert-danger" : "alert-light border"}`}>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Precio unitario:</span>
                  <strong>{marketPrice ? `$${marketPrice.toLocaleString()}` : "—"}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Total de la orden:</span>
                  <strong>${totalCost}</strong>
                </div>
                <hr className="my-1" />
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Tu saldo:</span>
                  <span className={insufficientFunds ? "text-danger fw-bold" : "text-success"}>
                    ${userBalance.toFixed(2)}
                  </span>
                </div>
                {orderType === "B" && qty && marketPrice && (
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Saldo post-orden:</span>
                    <span className={userBalance - parseFloat(totalCost) < 0 ? "text-danger fw-bold" : "text-success"}>
                      ${(userBalance - parseFloat(totalCost)).toFixed(2)}
                    </span>
                  </div>
                )}
                {insufficientFunds && (
                  <div className="mt-1 small text-danger fw-bold">⚠ Fondos insuficientes</div>
                )}
              </div>

              <button
                className={`btn w-100 fw-bold ${orderType === "B" ? "btn-success" : "btn-danger"}`}
                onClick={handleSubmit}
                disabled={loading || !marketPrice || (orderType === "B" && insufficientFunds)}
              >
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2" />Procesando...</>
                ) : (
                  `${orderType === "B" ? "Comprar" : "Vender"} ${symbolLabel}`
                )}
              </button>

              <hr />
              <small className="text-muted d-block text-center">
                Precio se actualiza cada 15 segundos.<br />
                La operación se refleja en <strong>Position</strong> y <strong>Orders</strong>.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Market_main;
