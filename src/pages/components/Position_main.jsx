import React, { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "../../API/axios";

const Position_main = () => {
  const [token] = useState(JSON.parse(localStorage.getItem("auth")) || "");
  const decoded = jwtDecode(token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        setLoading(true);
        const res = await axios.get("/api/v1/getTransacton_history");
        // Filtrar por usuario
        const myPositions = res.data.transaction.filter(
          (t) => t.sender === decoded.email
        );
        setPositions(myPositions);
      } catch (e) {
        console.error("Error fetching positions", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPositions();
  }, []);

  // Agrupar posiciones por stock: acumular qty, recalcular avg
  const grouped = positions.reduce((acc, pos) => {
    const key = pos.stocks;
    if (!acc[key]) {
      acc[key] = {
        stocks: key,
        qty: 0,
        totalCost: 0,
        cmp: pos.cmp,
        day_gain: pos.day_gain,
        returun: pos.returun,
      };
    }
    acc[key].qty += pos.qty;
    acc[key].totalCost += pos.qty * pos.avg;
    acc[key].cmp = pos.cmp;
    return acc;
  }, {});

  const groupedList = Object.values(grouped).map((g) => ({
    ...g,
    avg: g.qty > 0 ? (g.totalCost / g.qty).toFixed(2) : 0,
    value_cost: g.totalCost.toFixed(2),
    value_cmp: (g.qty * g.cmp).toFixed(2),
    pnl: ((g.qty * g.cmp) - g.totalCost).toFixed(2),
    pnlPct: g.totalCost > 0
      ? ((((g.qty * g.cmp) - g.totalCost) / g.totalCost) * 100).toFixed(2)
      : "0.00",
  }));

  const totalPages = Math.ceil(groupedList.length / PER_PAGE);
  const paginated = groupedList.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totalInvested = groupedList.reduce((s, g) => s + parseFloat(g.value_cost), 0);
  const totalCurrent = groupedList.reduce((s, g) => s + parseFloat(g.value_cmp), 0);
  const totalPnl = totalCurrent - totalInvested;

  return (
    <div className="container mt-3">
      {/* Resumen */}
      <div className="row mb-3">
        <div className="col-md-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h6 className="text-muted">Invertido total</h6>
              <h4 className="text-primary">${totalInvested.toFixed(2)}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h6 className="text-muted">Valor actual</h6>
              <h4 className="text-info">${totalCurrent.toFixed(2)}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h6 className="text-muted">P&L Total</h6>
              <h4 className={totalPnl >= 0 ? "text-success" : "text-danger"}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h4 className="card-title m-0">Mis Posiciones</h4>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="mt-2 text-muted">Cargando posiciones...</p>
            </div>
          ) : groupedList.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="fs-5">No tenés posiciones abiertas.</p>
              <p>Andá a <strong>Market</strong> para ejecutar tu primera operación.</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-bordered table-hover">
                  <thead className="thead-light">
                    <tr>
                      <th>#</th>
                      <th>Stock</th>
                      <th>Cantidad</th>
                      <th>Precio Promedio</th>
                      <th>Precio Actual (CMP)</th>
                      <th>Costo Total</th>
                      <th>Valor Actual</th>
                      <th>P&L ($)</th>
                      <th>P&L (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((item, index) => (
                      <tr key={item.stocks}>
                        <td>{(page - 1) * PER_PAGE + index + 1}</td>
                        <td><strong>{item.stocks}</strong></td>
                        <td>{item.qty}</td>
                        <td>${item.avg}</td>
                        <td>${item.cmp}</td>
                        <td>${item.value_cost}</td>
                        <td>${item.value_cmp}</td>
                        <td className={parseFloat(item.pnl) >= 0 ? "text-success" : "text-danger"}>
                          {parseFloat(item.pnl) >= 0 ? "+" : ""}${item.pnl}
                        </td>
                        <td className={parseFloat(item.pnlPct) >= 0 ? "text-success" : "text-danger"}>
                          {parseFloat(item.pnlPct) >= 0 ? "+" : ""}{item.pnlPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <nav className="float-end">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => setPage(p => p - 1)}>
                        Anterior
                      </button>
                    </li>
                    {[...Array(totalPages)].map((_, i) => (
                      <li key={i} className={`page-item ${page === i + 1 ? "active" : ""}`}>
                        <button className="page-link" onClick={() => setPage(i + 1)}>
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => setPage(p => p + 1)}>
                        Siguiente
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Position_main;
