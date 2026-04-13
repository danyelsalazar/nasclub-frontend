import React, { useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "../../API/axios";
import { toast } from "react-toastify";

const Market_main = () => {
  const tvContainer = useRef();
  const [token] = useState(JSON.parse(localStorage.getItem("auth")) || "");
  const decoded = jwtDecode(token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  const [ticker, setTicker] = useState("NASDAQ:AAPL");
  const [tickerInput, setTickerInput] = useState("NASDAQ:AAPL");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [orderType, setOrderType] = useState("B");
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(0);

  // Fetch user balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await axios.get("/api/v1/getFund_history");
        const myFunds = res.data.fund.filter(f => f.sender === decoded.email);
        let balance = 0;
        myFunds.forEach(f => {
          if (f.Format === "fund" && f.Type === "success") balance += f.amount;
          if (f.Format === "withdraw" && f.Type === "success") balance -= f.amount;
        });
        setUserBalance(balance);
      } catch (e) {
        console.error("Error fetching balance", e);
      }
    };
    fetchBalance();
  }, []);

  // Load TradingView widget
  useEffect(() => {
    if (!tvContainer.current) return;

    // Limpiar widget anterior
    tvContainer.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: "D",
      timezone: "Etc/UTC",
      theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    tvContainer.current.appendChild(script);
  }, [ticker]);

  const handleSearch = () => {
    if (tickerInput.trim()) {
      setTicker(tickerInput.trim().toUpperCase());
    }
  };

  const totalCost = qty && price ? (parseFloat(qty) * parseFloat(price)).toFixed(2) : "0.00";

  const handleSubmit = async () => {
    if (!qty || !price || parseFloat(qty) <= 0 || parseFloat(price) <= 0) {
      toast.error("Por favor ingresá cantidad y precio válidos");
      return;
    }

    if (orderType === "B" && parseFloat(totalCost) > userBalance) {
      toast.error(`Fondos insuficientes. Tu saldo es $${userBalance.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/v1/createMarketOrder", {
        ticker: ticker.includes(":") ? ticker.split(":")[1] : ticker,
        qty: parseFloat(qty),
        price: parseFloat(price),
        type: orderType,
        sender: decoded.email,
      });

      const newBalance = orderType === "B"
        ? userBalance - parseFloat(totalCost)
        : userBalance + parseFloat(totalCost);
      setUserBalance(newBalance);

      toast.success(
        `${orderType === "B" ? "Compra" : "Venta"} de ${qty} ${ticker} a $${price} ejecutada con éxito`
      );
      setQty("");
      setPrice("");
    } catch (err) {
      const msg = err.response?.data?.message || "Error al procesar la orden";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid mt-3">
      <div className="row mb-3">
        <div className="col">
          <h4 className="fw-bold text-primary mb-0">Market</h4>
          <small className="text-muted">Buscá un ticker y ejecutá órdenes de compra/venta</small>
        </div>
        <div className="col-auto align-self-center">
          <span className="badge bg-success fs-6">
            Saldo disponible: ${userBalance.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Buscador de ticker */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="d-flex gap-2 align-items-center">
            <input
              type="text"
              className="form-control"
              placeholder="Ej: NASDAQ:AAPL, NYSE:TSLA, BINANCE:BTCUSDT"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{ maxWidth: "400px" }}
            />
            <button className="btn btn-primary" onClick={handleSearch}>
              Ver Gráfico
            </button>
            <span className="text-muted small">
              Ticker actual: <strong>{ticker}</strong>
            </span>
          </div>
          <small className="text-muted">
            Formato: EXCHANGE:TICKER — ej: NASDAQ:AAPL, NYSE:MSFT, BINANCE:BTCUSDT, FX:EURUSD
          </small>
        </div>
      </div>

      <div className="row">
        {/* Gráfico TradingView */}
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body p-0" style={{ height: "500px" }}>
              <div
                className="tradingview-widget-container"
                ref={tvContainer}
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Panel de orden */}
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Ejecutar Orden</h5>
              <small>{ticker}</small>
            </div>
            <div className="card-body">
              {/* Buy / Sell toggle */}
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

              <div className="mb-3">
                <label className="form-label fw-semibold">Cantidad</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Ej: 10"
                  min="0"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Precio por unidad ($)</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Ej: 150.00"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="alert alert-light border mb-3">
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Total de la orden:</span>
                  <strong>${totalCost}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Tu saldo:</span>
                  <span className={userBalance < parseFloat(totalCost) && orderType === "B" ? "text-danger" : "text-success"}>
                    ${userBalance.toFixed(2)}
                  </span>
                </div>
                {orderType === "B" && (
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Saldo post-orden:</span>
                    <span className={userBalance - parseFloat(totalCost) < 0 ? "text-danger" : "text-success"}>
                      ${(userBalance - parseFloat(totalCost || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {orderType === "B" && parseFloat(totalCost) > userBalance && (
                <div className="alert alert-danger py-2 small">
                  Fondos insuficientes para esta orden
                </div>
              )}

              <button
                className={`btn w-100 ${orderType === "B" ? "btn-success" : "btn-danger"}`}
                onClick={handleSubmit}
                disabled={loading || (orderType === "B" && parseFloat(totalCost) > userBalance)}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Procesando...
                  </>
                ) : (
                  `${orderType === "B" ? "Comprar" : "Vender"} ${ticker.includes(":") ? ticker.split(":")[1] : ticker}`
                )}
              </button>

              <hr />
              <small className="text-muted">
                Toda operación se registra en <strong>Position</strong> y <strong>Orders</strong> automáticamente.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Market_main;
