import React, { useEffect, useState } from "react";
import axios from "../../API/axios";
import { jwtDecode } from "jwt-decode";
import editIcon from "../../assets/edit.png";
import redTrashIcon from "../../assets/redTrashIcon.png";
import { toast } from "react-toastify";

const Order_main = () => {
  const [page, setPage] = useState(1);
  const url = "/api/v1/getOrder";
  const [token] = useState(JSON.parse(localStorage.getItem("auth")) || "");
  const decoded = jwtDecode(token);
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  const isAdmin = decoded.role === "admin";

  const header_menu = [
    { name: "Nombre", tag: "name" },
    { name: "Estado", tag: "status" },
    { name: "Hora", tag: "Time" },
    { name: "Tipo", tag: "Type" },
    { name: "Opción", tag: "Option" },
    { name: "Cantidad", tag: "Qty" },
    { name: "Valor", tag: "value" },
    { name: "CMP", tag: "CMP" },
    { name: "Precio", tag: "price" },
  ];

  const [allOrders, setAllOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectItem, setSelectItem] = useState({});

  const myOrders = isAdmin
    ? allOrders
    : allOrders.filter((o) => o.sender === decoded.email);

  const totalPages = Math.ceil(myOrders.length / 10);

  const fetchData = async () => {
    try {
      const response = await axios.get(url);
      setAllOrders(response.data.order);
    } catch (error) {
      console.log("Error:", error.response ? error.response.data : error.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const Save = async () => {
    try {
      const response = await axios.post(url, selectItem);
      setAllOrders(response.data.order);
      setShowModal(false);
      toast.success("Orden actualizada correctamente");
    } catch (e) {
      toast.error("Error al guardar la orden");
    }
  };

  const deleteItem = async (id) => {
    try {
      const response = await axios.delete(`${url}/${id}`);
      setAllOrders(response.data.order);
      toast.success("Orden eliminada");
    } catch (e) {
      toast.error("Error al eliminar la orden");
    }
  };

  const canEdit = (order) => isAdmin || order.sender === decoded.email;

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-primary text-white">
        <div className="row align-items-center">
          <div className="col">
            <h4 className="card-title mb-0">
              {isAdmin ? "Todas las Órdenes" : "Mis Órdenes"}
            </h4>
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-bordered table-hover table-striped">
            <thead className="thead-light">
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Hora</th>
                <th colSpan="2">Tipo</th>
                <th>Cantidad</th>
                <th>Valor</th>
                <th>CMP</th>
                <th>Precio</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {myOrders.map((item, index) => {
                if (index > 10 * page - 11 && index < 10 * page)
                  return (
                    <tr key={item._id || index}>
                      <td>{item.name}</td>
                      <td>
                        <span
                          className={
                            item.status === "successful"
                              ? "text-success"
                              : item.status === "pending"
                              ? "text-warning"
                              : "text-danger"
                          }
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>{item.Time}</td>
                      <td>{item.Option}</td>
                      <td>
                        <span className={item.Type === "B" ? "text-success fw-bold" : "text-danger fw-bold"}>
                          {item.Type === "B" ? "Buy" : item.Type === "S" ? "Sell" : item.Type}
                        </span>
                      </td>
                      <td>{item.Qty}</td>
                      <td>${item.value}</td>
                      <td>{item.CMP}</td>
                      <td>${item.price}</td>
                      <td>
                        {canEdit(item) && (
                          <>
                            <img
                              src={editIcon}
                              width={20}
                              alt="edit"
                              className="mx-1"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSelectItem(item);
                                setShowModal(true);
                              }}
                            />
                            <img
                              src={redTrashIcon}
                              width={20}
                              alt="delete"
                              className="mx-1"
                              style={{ cursor: "pointer" }}
                              onClick={() => deleteItem(item._id)}
                            />
                          </>
                        )}
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>

        {myOrders.length === 0 && (
          <div className="text-center py-4 text-muted">
            No hay órdenes para mostrar. Realizá una operación en <strong>Market</strong>.
          </div>
        )}

        {/* Paginación */}
        <nav aria-label="Pagination" className="d-flex justify-content-end">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(page - 1)} disabled={page === 1}>
                Anterior
              </button>
            </li>
            {[...Array(Math.ceil(myOrders.length / 10)).keys()].map((p) => (
              <li key={p} className={`page-item ${page === p + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => setPage(p + 1)}>
                  {p + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${page === Math.ceil(myOrders.length / 10) ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(page + 1)} disabled={page === Math.ceil(myOrders.length / 10)}>
                Siguiente
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Modal de edición */}
      {showModal && (
        <div className="modal fade show" style={{ display: "block" }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-5 p-4">
              <h3 className="mb-4 text-center">Editar Orden</h3>
              <form>
                {header_menu.map((item, index) => (
                  <div key={index} className="mb-3 row align-items-center">
                    <label className="col-md-4 col-form-label">{item.name}</label>
                    <div className="col-md-8">
                      <input
                        type="text"
                        className="form-control"
                        name={item.tag}
                        value={selectItem[item.tag] || ""}
                        onChange={(e) =>
                          setSelectItem({ ...selectItem, [item.tag]: e.target.value })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div className="d-flex justify-content-center gap-2">
                  <button type="button" className="btn btn-primary" onClick={Save}>
                    Guardar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Order_main;
