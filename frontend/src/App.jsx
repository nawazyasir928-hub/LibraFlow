import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";
const TOKEN_KEY = "libraflow-token";

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  let response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Backend se connection nahi ho raha. Port 5000 check karo.");
  }

  const responseText = await response.text();
  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText || "Invalid server response." };
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Server error: ${response.status}`
    );
  }

  return data;
}

const idOf = (item) => String(item?._id || item?.id || "");

const dateText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const today = () => new Date().toISOString().slice(0, 10);

function PanelHeader({ title, subtitle, right }) {
  return (
    <div className="panel-header">
      <div className="panel-title-group">
        <span className="panel-icon">▤</span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function Stat({ title, value, color = "purple", onClick }) {
  return (
    <div
      className={`stat-card ${color}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className={`stat-icon ${color}`}>▤</div>
      <div className="stat-information">
        <h2>{value}</h2>
        <p>{title}</p>
      </div>
    </div>
  );
}

function SearchField({ value, onChange, placeholder = "Search..." }) {
  return (
    <input
      className="page-search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function DataTable({ headers, rows }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookTable({ books, isAdmin, onEdit, onDelete, onRead }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>BOOK TITLE</th>
            <th>AUTHOR</th>
            <th>CATEGORY</th>
            <th>AVAILABLE</th>
            {(isAdmin || onRead) && <th>ACTION</th>}
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={idOf(book)}>
              <td>
                <strong>{book.title}</strong>
                <small className="table-subtext">ISBN: {book.isbn}</small>
              </td>
              <td>{book.author}</td>
              <td>{book.category}</td>
              <td>
                <span className={`status ${book.availableCopies > 0 ? "available" : "borrowed"}`}>
                  {book.availableCopies} / {book.quantity}
                </span>
              </td>
              {(isAdmin || onRead) && (
                <td className="action-cell">
                  {isAdmin ? <><button className="approve-button" onClick={() => onEdit(book)}>Edit</button><button className="reject-button" onClick={() => onDelete(book)}>Delete</button></> : <button className="approve-button" onClick={() => onRead(book)}>Read e-book</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {books.length === 0 && <EmptyState text="No books found." />}
    </div>
  );
}

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-screen">
      <div className="auth-image">
        <div className="auth-image-overlay">
          <div className="auth-brand"><span>L</span> LibraFlow</div>
          <div className="auth-message">
            <span>YOUR DIGITAL LIBRARY</span>
            <h1>Knowledge begins with a single page.</h1>
            <p>Discover, manage and explore your library in one place.</p>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-card">
          <div className="auth-mobile-brand">L <strong>LibraFlow</strong></div>
          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function PublicBookCard({ book, onPreview }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const isbn = String(book.isbn || book.ISBN || book.isbn13 || book.isbn10 || "").replace(/[^0-9X]/gi, "");
  const coverUrl = book.coverUrl || book.coverImage || book.imageUrl || book.image || book.thumbnail ||
    (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "");

  return (
    <article className="public-book-card">
      <button type="button" className="public-cover public-cover-button" onClick={() => onPreview(book)} aria-label={`View ${book.title}`}>
        {coverUrl && !coverFailed ? (
          <img src={coverUrl} alt={`Cover of ${book.title}`} loading="lazy" onError={() => setCoverFailed(true)} />
        ) : (
          <div className="cover-placeholder">
            <span>LIBRAFLOW COLLECTION</span>
            <b>{book.title || "Untitled book"}</b>
            <small>{book.author || "Unknown author"}</small>
          </div>
        )}
        <span className="cover-tag">{book.category || "Literature"}</span>
      </button>
      <div className="public-book-info">
        <h3>{book.title || "Untitled book"}</h3>
        <p>{book.author || "Unknown author"}</p>
        <button type="button" onClick={() => onPreview(book)}>View book details <span>↗</span></button>
      </div>
    </article>
  );
}

function PublicFooter({ onLogin }) { return <footer className="public-footer"><div className="public-brand"><span className="public-brand-mark">L</span><span>LibraFlow<small>Digital Library</small></span></div><p>Discover. Learn. Read.</p><button onClick={onLogin}>Member sign in →</button><small>© {new Date().getFullYear()} LibraFlow Library</small></footer>; }

export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [books, setBooks] = useState([]);
  const [publicBooks, setPublicBooks] = useState([]);
  const [publicSearch, setPublicSearch] = useState("");
  const [publicCategory, setPublicCategory] = useState("All");
  const [previewBook, setPreviewBook] = useState(null);
  const [members, setMembers] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    type: "info",
  });

  const [login, setLogin] = useState({ email: "", password: "" });

  const [register, setRegister] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    category: "",
    isbn: "",
    quantity: "",
  });

  const [editingBook, setEditingBook] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  const isAdmin = user?.role === "admin";
  const unreadNotifications = notifications.filter(
    (item) => !item.isRead && !item.read
  ).length;

  function notify(text) {
    setMessage(text);
    window.clearTimeout(window.__libraToast);
    window.__libraToast = window.setTimeout(() => setMessage(""), 5000);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setBooks([]);
    setMembers([]);
    setRecords([]);
    setNotifications([]);
    setPage("home");
  }

  function enterApp(data) {
    if (!data?.token || !data?.user) {
      throw new Error("Login response did not contain a valid token and user.");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);

    setProfile({
      name: data.user.name || "",
      phone: data.user.phone || "",
      address: data.user.address || "",
    });

    setPage(data.user.role === "admin" ? "dashboard" : "user-dashboard");
  }

  async function loadAll() {
    setLoading(true);

    try {
      const bookData = await request("/books");
      setBooks(Array.isArray(bookData) ? bookData : []);

      if (user?.role === "admin") {
        const [memberData, recordData] = await Promise.all([
          request("/members"),
          request("/borrow"),
        ]);

        setMembers(Array.isArray(memberData) ? memberData : []);
        setRecords(Array.isArray(recordData) ? recordData : []);
      } else if (user) {
        const [memberData, recordData] = await Promise.all([
          request("/members/me"),
          request("/borrow"),
        ]);

        setMembers(
          memberData?.member
            ? [memberData.member]
            : memberData
              ? [memberData]
              : []
        );

        setRecords(Array.isArray(recordData) ? recordData : []);
      }
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    try {
      const data = await request("/notifications");
      const list = Array.isArray(data)
        ? data
        : data.notifications || data.items || [];
      setNotifications(list);
    } catch (error) {
      console.error("Notifications could not be loaded:", error.message);
    }
  }

  async function markNotificationRead(item) {
    if (item.isRead || item.read) return;

    try {
      await request(`/notifications/${idOf(item)}/read`, {
        method: "PATCH",
      });

      setNotifications((old) =>
        old.map((n) =>
          idOf(n) === idOf(item)
            ? { ...n, isRead: true, read: true }
            : n
        )
      );
    } catch (error) {
      notify(error.message);
    }
  }
    async function createNotification(e) {
    e.preventDefault();

    try {
      await request("/notifications", {
        method: "POST",
        body: JSON.stringify(notificationForm),
      });

      setNotificationForm({ title: "", message: "", type: "info" });
      await loadNotifications();
      notify("Notification created successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function deleteNotification(item) {
    if (!window.confirm("Delete this notification?")) return;

    try {
      await request(`/notifications/${idOf(item)}`, {
        method: "DELETE",
      });

      setNotifications((old) =>
        old.filter((n) => idOf(n) !== idOf(item))
      );

      notify("Notification deleted.");
    } catch (error) {
      notify(error.message);
    }
  }

  useEffect(() => {
    let active = true;
    fetch(`${API}/books?limit=1000&page=1`)
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setPublicBooks(Array.isArray(data) ? data : (data.books || []));
      })
      .catch((error) => console.error("Public catalogue could not load:", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token) return;
    loadNotifications();
  }, [token, user]);

  useEffect(() => {
    if (!token) return;

    let active = true;

    request("/auth/me")
      .then((data) => {
        if (!active) return;

        const currentUser = data.user || data.member || data;

        setUser(currentUser);

        setProfile({
          name: currentUser.name || "",
          phone: currentUser.phone || "",
          address: currentUser.address || "",
        });

        setPage(currentUser.role === "admin" ? "dashboard" : "user-dashboard");
      })
      .catch((error) => {
        if (!active) return;

        console.error("Session verification failed:", error);

        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
        setPage("home");
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!user || !token) return;
    loadAll();
  }, [user, token]);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("library:update", () => loadAll());

    return () => socket.disconnect();
  }, [token, user]);

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: login.email.trim().toLowerCase(),
          password: login.password,
        }),
      });

      enterApp(data);
      notify("Welcome to LibraFlow.");
    } catch (error) {
      console.error("Login failed:", error);
      notify(error.message);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();

    if (register.password.length < 8) {
      return notify("Password must contain at least 8 characters.");
    }

    if (register.password !== register.confirmPassword) {
      return notify("Passwords do not match.");
    }

    try {
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: register.name,
          email: register.email,
          phone: register.phone,
          address: register.address,
          password: register.password,
        }),
      });

      setRegister({
        name: "",
        email: "",
        phone: "",
        address: "",
        password: "",
        confirmPassword: "",
      });

      setLogin((old) => ({ ...old, email: register.email }));
      setPage("login");
      notify("Registration submitted. Wait for administrator approval.");
    } catch (error) {
      notify(error.message);
    }
  }

  function navigate(next) {
    setPage(next);
    setSearch("");
  }

  async function openEbook(book) {
    try {
      const result = await request(`/books/${idOf(book)}/read`);
      if (!result?.url) throw new Error("No digital edition is available for this title.");
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveBook(e) {
    e.preventDefault();

    const quantity = Number(bookForm.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return notify("Quantity must be a positive whole number.");
    }

    if (!/^\d{10,13}$/.test(bookForm.isbn.trim())) {
      return notify("ISBN must contain 10 to 13 digits.");
    }

    try {
      if (editingBook) {
        const borrowed = editingBook.quantity - editingBook.availableCopies;

        if (quantity < borrowed) {
          return notify(`At least ${borrowed} copies are currently borrowed.`);
        }

        await request(`/books/${idOf(editingBook)}`, {
          method: "PUT",
          body: JSON.stringify({
            ...bookForm,
            quantity,
            availableCopies: quantity - borrowed,
          }),
        });

        notify("Book updated successfully.");
      } else {
        await request("/books", {
          method: "POST",
          body: JSON.stringify({
            ...bookForm,
            quantity,
            availableCopies: quantity,
          }),
        });

        notify("Book added successfully.");
      }

      setBookForm({
        title: "",
        author: "",
        category: "",
        isbn: "",
        quantity: "",
      });

      setEditingBook(null);
      await loadAll();
    } catch (error) {
      notify(error.message);
    }
  }

  function startEditBook(book) {
    setEditingBook(book);

    setBookForm({
      title: book.title,
      author: book.author,
      category: book.category,
      isbn: book.isbn,
      quantity: String(book.quantity),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteBook(book) {
    if (book.quantity !== book.availableCopies) {
      return notify("This book has active borrowing records and cannot be deleted.");
    }

    if (!window.confirm(`Delete "${book.title}"?`)) return;

    try {
      await request(`/books/${idOf(book)}`, { method: "DELETE" });
      await loadAll();
      notify("Book deleted successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function approveMember(member) {
    try {
      await request(`/members/${idOf(member)}/approval`, {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus: "Approved" }),
      });

      await loadAll();
      notify("Member approved successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function rejectMember(member) {
    if (!window.confirm(`Reject registration for ${member.name}?`)) return;

    try {
      await request(`/members/${idOf(member)}/approval`, {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus: "Rejected" }),
      });

      await loadAll();
      notify("Registration rejected.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function updateMemberStatus(member, status) {
    try {
      await request(`/members/${idOf(member)}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      await loadAll();
      notify(`Member status changed to ${status}.`);
    } catch (error) {
      notify(error.message);
    }
  }

  async function deleteMember(member) {
    if (!window.confirm(`Delete member ${member.name}?`)) return;

    try {
      await request(`/members/${idOf(member)}`, { method: "DELETE" });
      await loadAll();
      notify("Member deleted.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function borrowBook(e) {
    e.preventDefault();

    const formElement = e.currentTarget;
    const form = new FormData(formElement);

    const bookId = form.get("bookId");
    const memberId = form.get("memberId");
    const dueDate = form.get("dueDate");

    if (!bookId || !memberId || !dueDate) {
      return notify("Please select a book, member and due date.");
    }

    try {
      await request("/borrow", {
        method: "POST",
        body: JSON.stringify({ bookId, memberId, dueDate }),
      });

      formElement.reset();

      await loadAll();
      notify("Book issued successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function returnBook(record) {
    if (!window.confirm("Confirm that this book has been returned?")) return;

    try {
      await request(`/borrow/${idOf(record)}/return`, {
        method: "PUT",
      });

      await loadAll();
      notify("Book returned successfully.");
    } catch (error) {
      notify(error.message);
    }
  }
    async function saveProfile(e) {
    e.preventDefault();

    try {
      const data = await request("/members/me", {
        method: "PUT",
        body: JSON.stringify(profile),
      });

      const updatedMember = data.member || data.user || data;

      setUser(updatedMember);
      notify("Profile updated.");
    } catch (error) {
      notify(error.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    try {
      await request("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify(passwordForm),
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
      });

      notify("Password changed successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  function exportCSV() {
    const rows = [
      ["Book", "Member", "Borrow Date", "Due Date", "Return Date", "Status"],
      ...filteredRecords.map((record) => [
        record.book?.title,
        record.member?.name,
        dateText(record.borrowDate),
        dateText(record.dueDate),
        dateText(record.returnDate),
        record.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "LibraFlow-Report.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  const pendingMembers = members.filter(
    (m) => m.approvalStatus === "Pending"
  );

  const approvedMembers = members.filter(
    (m) => m.approvalStatus === "Approved" && m.status === "Active"
  );

  const borrowedRecords = records.filter(
    (r) => r.status === "Borrowed"
  );

  const overdueRecords = borrowedRecords.filter(
    (r) => new Date(r.dueDate) < new Date()
  );

  const filteredBooks = books.filter((b) =>
    `${b.title} ${b.author} ${b.category} ${b.isbn}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredMembers = members.filter((m) =>
    `${m.name} ${m.email} ${m.phone}`
      .toLowerCase()
      .includes(memberSearch.toLowerCase())
  );

  const filteredRecords = records.filter((r) => {
    const bookName = r.book?.title || "";
    const memberName = r.member?.name || "";

    const matchesSearch = `${bookName} ${memberName} ${r.status}`
      .toLowerCase()
      .includes(reportSearch.toLowerCase());

    const parsedDate = r.borrowDate ? new Date(r.borrowDate) : null;

    const borrowDate =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : "";

    return (
      matchesSearch &&
      (!reportFrom || (borrowDate && borrowDate >= reportFrom)) &&
      (!reportTo || (borrowDate && borrowDate <= reportTo))
    );
  });

  const monthlyBorrowing = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));

    const year = date.getFullYear();
    const month = date.getMonth();

    const issues = records.filter((record) => {
      const borrowDate = record.borrowDate
        ? new Date(record.borrowDate)
        : null;

      return (
        borrowDate &&
        borrowDate.getFullYear() === year &&
        borrowDate.getMonth() === month
      );
    }).length;

    const returns = records.filter((record) => {
      const returnDate = record.returnDate
        ? new Date(record.returnDate)
        : null;

      return (
        returnDate &&
        returnDate.getFullYear() === year &&
        returnDate.getMonth() === month
      );
    }).length;

    return {
      label: date.toLocaleDateString("en-US", { month: "short" }),
      issues,
      returns,
    };
  });

  const maxMonthlyValue = Math.max(
    1,
    ...monthlyBorrowing.map((item) =>
      Math.max(item.issues, item.returns)
    )
  );

  const inventoryByCategory = Object.values(
    books.reduce((groups, book) => {
      const category = book.category || "Uncategorised";

      if (!groups[category]) {
        groups[category] = {
          category,
          total: 0,
          available: 0,
        };
      }

      groups[category].total += Number(book.quantity || 0);
      groups[category].available += Number(
        book.availableCopies || 0
      );

      return groups;
    }, {})
  );

  const totalInventoryCopies = books.reduce(
    (sum, book) => sum + Number(book.quantity || 0),
    0
  );

  const totalAvailableCopies = books.reduce(
    (sum, book) => sum + Number(book.availableCopies || 0),
    0
  );

  const totalBorrowedCopies = Math.max(
    0,
    totalInventoryCopies - totalAvailableCopies
  );

  const memberBorrowedRecords = records.filter((r) => r.status === "Borrowed");
  const memberOverdueRecords = memberBorrowedRecords.filter(
    (r) => r.dueDate && new Date(r.dueDate) < new Date()
  );
  const memberDueSoonRecords = memberBorrowedRecords.filter((r) => {
    if (!r.dueDate) return false;
    const due = new Date(r.dueDate);
    const days = (due.getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  });
  const reservedRecords = records.filter((r) =>
    String(r.status || "").toLowerCase().includes("reserv")
  );
  const popularBooks = [...books]
    .sort((a, b) => Number(b.borrowCount || b.timesBorrowed || 0) - Number(a.borrowCount || a.timesBorrowed || 0))
    .slice(0, 5);
  const categorySummary = inventoryByCategory
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const count = records.filter((record) => {
      if (!record.borrowDate) return false;
      const borrowed = new Date(record.borrowDate);
      return borrowed.toDateString() === day.toDateString();
    }).length;
    return { label: day.toLocaleDateString("en-US", { weekday: "short" }), count };
  });
  const maxWeeklyActivity = Math.max(1, ...weeklyActivity.map((item) => item.count));

  const menuAdmin = [
    ["dashboard", "▦", "Dashboard"],
    ["books", "▤", "Books"],
    ["members", "♙", "Members"],
    ["approvals", "✓", "Member Approvals"],
    ["borrow", "⇄", "Borrow & Return"],
    ["reports", "▥", "Reports"],
    ["notifications", "♢", "Notifications"],
    ["profile", "◉", "My Profile"],
  ];

  const menuMember = [
    ["user-dashboard", "▦", "My Dashboard"],
    ["my-books", "▤", "My Borrowed Books"],
    ["catalog", "⌕", "Book Catalogue"],
    ["notifications", "♢", "Notifications"],
    ["profile", "◉", "My Profile"],
  ];

  const menu = isAdmin ? menuAdmin : menuMember;

  const pageTitle =
    [...menuAdmin, ...menuMember].find((m) => m[0] === page)?.[2] ||
    "LibraFlow";
      function showPublicSection(sectionId) {
    if (page !== "home") {
      setPage("home");
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function requireSignInForDownload() {
    setPreviewBook(null);
    setPage("login");
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("Please sign in to download or open this book.");
  }

  if (!user) {
    const categories = ["All", ...new Set(publicBooks.map((book) => book.category).filter(Boolean))].slice(0, 80);
    const visiblePublicBooks = publicBooks.filter((book) => {
      const query = publicSearch.trim().toLowerCase();
      const matchesText = !query || `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query);
      return matchesText && (publicCategory === "All" || book.category === publicCategory);
    });

    if (page === "login" || page === "register") {
      return (
        <div className="public-auth-shell">
          <header className="public-nav"><button className="public-brand" onClick={() => setPage("home")}> <span className="public-brand-mark">L</span><span>LibraFlow<small>Digital Library</small></span></button><button className="public-nav-link" onClick={() => setPage("catalog-public")}>Explore books</button></header>
          <section className="public-auth-card">
            <div className="public-auth-art"><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>A world of stories, knowledge and ideas.</h1><p>Discover the collection, then sign in to access available digital editions.</p><div className="auth-book-stack"><i>READ</i><i>LEARN</i><i>GROW</i></div></div>
            <div className="public-auth-form"><button className="back-link" onClick={() => setPage("home")}>← Back to home</button>
              {page === "register" ? <><h2>Create your account</h2><p className="public-muted">Register as a library member. Admin approval is required.</p><form className="app-form" onSubmit={handleRegister}><label>Full Name</label><input required value={register.name} onChange={(e)=>setRegister({...register,name:e.target.value})}/><label>Email Address</label><input type="email" required value={register.email} onChange={(e)=>setRegister({...register,email:e.target.value})}/><label>Phone Number</label><input required value={register.phone} onChange={(e)=>setRegister({...register,phone:e.target.value})}/><label>Address</label><input required value={register.address} onChange={(e)=>setRegister({...register,address:e.target.value})}/><label>Password</label><input type="password" minLength="8" required value={register.password} onChange={(e)=>setRegister({...register,password:e.target.value})}/><label>Confirm Password</label><input type="password" required value={register.confirmPassword} onChange={(e)=>setRegister({...register,confirmPassword:e.target.value})}/><button className="primary-button full-button">Create account</button></form><p className="auth-switch">Already a member? <button type="button" onClick={()=>setPage("login")}>Sign in</button></p></> : <><h2>Welcome back</h2><p className="public-muted">Sign in to continue to your LibraFlow account.</p><form className="app-form" onSubmit={handleLogin}><label>Email Address</label><input type="email" required placeholder="Enter your email" value={login.email} onChange={(e)=>setLogin({...login,email:e.target.value})}/><label>Password</label><input type="password" required placeholder="Enter your password" value={login.password} onChange={(e)=>setLogin({...login,password:e.target.value})}/><button className="primary-button full-button" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button></form><p className="auth-switch">New to LibraFlow? <button type="button" onClick={()=>setPage("register")}>Create account</button></p></>}
            </div>
          </section>{message && <div className="toast">{message}</div>}
        </div>
      );
    }

    return (
      <div className="public-site">
        <header className="public-nav">
          <button className="public-brand" onClick={() => { setPage("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="public-brand-mark">L</span><span>LibraFlow<small>Digital Library</small></span>
          </button>
          <nav>
            <button className={page === "home" ? "selected" : ""} onClick={() => { setPage("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Home</button>
            <button className={page === "catalog-public" ? "selected" : ""} onClick={() => { setPreviewBook(null); setPage("catalog-public"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Books</button>
            <button type="button" onClick={() => showPublicSection("about")}>About</button>
            <button type="button" onClick={() => showPublicSection("services")}>Services</button>
          </nav>
          <div className="public-nav-actions">
            <button className="public-login" onClick={() => setPage("login")}>Log in</button>
            <button className="public-join" onClick={() => setPage("register")}>Join the library <span>↗</span></button>
          </div>
        </header>
        {page === "home" ? <><main><section className="public-hero"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot"></span> A LIBRARY THAT MOVES WITH YOU</span><h1>Where every book opens <em>a new world.</em></h1><p>Explore timeless classics, discover new ideas, and make room for your next great read with LibraFlow.</p><div className="hero-actions"><button className="public-join large" onClick={()=>setPage("catalog-public")}>Explore the collection <span>→</span></button><button className="hero-secondary" onClick={()=>setPage("login")}>Member sign in</button></div><div className="hero-proof"><div className="proof-avatars"><i>R</i><i>A</i><i>M</i><i>+</i></div><span><b>{publicBooks.length ? `${publicBooks.length.toLocaleString()}+` : "Growing"}</b> books to explore</span></div></div><div className="hero-visual"><div className="hero-orbit"></div><div className="hero-book book-one"><small>THE CLASSICS</small><b>Stories<br/>that stay.</b><span>LIBRAFLOW COLLECTION</span></div><div className="hero-book book-two"><small>KNOWLEDGE</small><b>Ideas for<br/>tomorrow.</b><span>DISCOVER MORE</span></div><div className="hero-note"><span>✦</span><div><b>Find your next favourite</b><small>One page at a time</small></div></div></div></section>
          <section className="public-stats"><div><b>{publicBooks.length ? `${publicBooks.length.toLocaleString()}+` : "1,000+"}</b><span>Catalogue titles</span></div><div><b>24/7</b><span>Browse anytime</span></div><div><b>Free</b><span>Public-domain reading</span></div><div><b>One place</b><span>Your library journey</span></div></section>
          <section className="public-featured"><div className="section-heading"><div><span className="eyebrow">CURATED FOR CURIOUS MINDS</span><h2>Explore the collection</h2><p>A small preview of the books waiting for you.</p></div><button className="text-link" onClick={()=>setPage("catalog-public")}>View all books →</button></div><div className="public-book-grid">{publicBooks.slice(0,4).map((book)=><PublicBookCard key={book._id} book={book} onPreview={setPreviewBook}/>)}</div></section>
          <section className="public-about" id="about"><span className="eyebrow">ABOUT LIBRAFLOW</span><h2>More than a bookshelf.<br/><em>A space to grow.</em></h2><p>LibraFlow brings a thoughtfully organised library catalogue and member services together in one simple experience.</p></section>
          <section className="public-services" id="services"><div><span>01</span><h3>Discover</h3><p>Search titles, authors and subjects across the catalogue.</p></div><div><span>02</span><h3>Borrow</h3><p>Manage your library borrowing through your member account.</p></div><div><span>03</span><h3>Read</h3><p>Sign in to open legally accessible digital editions.</p></div></section></main><PublicFooter onLogin={()=>setPage("login")}/></> : <><main className="catalog-page"><div className="catalog-intro"><span className="eyebrow">THE LIBRAFLOW COLLECTION</span><h1>Find a book that <em>moves you.</em></h1><p>Explore books by title, author or subject. Sign in to open available digital editions.</p></div><div className="catalog-toolbar"><input value={publicSearch} onChange={(e)=>setPublicSearch(e.target.value)} placeholder="Search titles, authors, subjects..."/><select value={publicCategory} onChange={(e)=>setPublicCategory(e.target.value)}>{categories.map((cat)=><option key={cat}>{cat}</option>)}</select><span>{visiblePublicBooks.length.toLocaleString()} titles</span></div><div className="public-book-grid catalog-grid">{visiblePublicBooks.slice(0,1000).map((book)=><PublicBookCard key={book._id} book={book} onPreview={setPreviewBook}/>)}</div>{visiblePublicBooks.length===0 && <div className="catalog-empty">No books found. Try another title or subject.</div>}</main><PublicFooter onLogin={()=>setPage("login")}/></>}
        {previewBook && (
          <div className="public-preview-backdrop" role="presentation" onClick={() => setPreviewBook(null)}>
            <section className="public-preview-modal" role="dialog" aria-modal="true" aria-label="Book details" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="public-preview-close" onClick={() => setPreviewBook(null)} aria-label="Close preview">×</button>
              <div className="public-preview-cover">
                {(() => {
                  const isbn = String(previewBook.isbn || previewBook.ISBN || previewBook.isbn13 || previewBook.isbn10 || "").replace(/[^0-9X]/gi, "");
                  const src = previewBook.coverUrl || previewBook.coverImage || previewBook.imageUrl || previewBook.image || previewBook.thumbnail || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "");
                  return src ? <img src={src} alt={`Cover of ${previewBook.title}`} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="cover-placeholder"><span>LIBRAFLOW COLLECTION</span><b>{previewBook.title}</b><small>{previewBook.author}</small></div>;
                })()}
              </div>
              <div className="public-preview-details">
                <span className="eyebrow">BOOK PREVIEW</span>
                <h2>{previewBook.title || "Untitled book"}</h2>
                <p className="preview-author">By {previewBook.author || "Unknown author"}</p>
                <p><strong>Category:</strong> {previewBook.category || "Not specified"}</p>
                {previewBook.isbn && <p><strong>ISBN:</strong> {previewBook.isbn}</p>}
                {previewBook.description && <p className="preview-description">{previewBook.description}</p>}
                <p className="preview-access-note">You can view this book's cover and details without an account. Sign in is required only to open or download the digital book.</p>
                <button type="button" className="public-join" onClick={requireSignInForDownload}>Sign in to download / read ↗</button>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="app-container">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">L</div>
            <div>
              <h2>LibraFlow</h2>
              <span>Library Management</span>
            </div>
          </div>

          <p className="menu-heading">MAIN MENU</p>

          <nav className="sidebar-nav">
            {menu.map(([id, icon, label]) => (
              <button
                key={id}
                className={`menu-item ${page === id ? "active" : ""}`}
                onClick={() => navigate(id)}
              >
                <span className="menu-icon">{icon}</span>
                {label}

                {id === "approvals" && pendingMembers.length > 0 && (
                  <span className="menu-count">{pendingMembers.length}</span>
                )}

                {id === "notifications" && unreadNotifications > 0 && (
                  <span className="menu-count">{unreadNotifications}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="admin-avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>

            <div className="admin-details">
              <strong>{user.name}</strong>
              <span>{isAdmin ? "Administrator" : "Library Member"}</span>
            </div>

            <span className="online-dot" />
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="topbar-search">
              <span>⌕</span>
              <input
                placeholder="Search books..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="topbar-right">
              <span className={`status ${socketConnected ? "available" : "borrowed"}`}>
                {socketConnected ? "Live" : "Offline"}
              </span>

              <button
                className="notification-bell"
                                title="Notifications"
                onClick={() => navigate("notifications")}
              >
                ♢
                {unreadNotifications > 0 && (
                  <span>{unreadNotifications}</span>
                )}
              </button>

              <button
                className="profile profile-button"
                onClick={() => navigate("profile")}
              >
                <div className="profile-avatar">
                  {user.name?.charAt(0).toUpperCase()}
                </div>

                <div>
                  <strong>{user.name}</strong>
                  <span>{isAdmin ? "Administrator" : "Member"}</span>
                </div>
              </button>

              <button className="logout-button" onClick={logout}>
                Logout
              </button>
            </div>
          </header>

          <section className="dashboard-heading">
            <h1>{pageTitle}</h1>
            <p>
              {loading
                ? "Synchronising library data..."
                : "Library Management System"}
            </p>
          </section>

          {page === "dashboard" && isAdmin && (
            <div className="admin-dashboard-v2">
              <section className="admin-welcome-strip">
                <div>
                  <span className="eyebrow">LIBRARY CONTROL CENTER</span>
                  <h2>Good to see you, {user.name?.split(" ")[0] || "Admin"}</h2>
                  <p>Here’s your library at a glance. Keep every collection moving.</p>
                </div>
                <div className="welcome-date"><span>LIVE SYSTEM</span><strong>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong></div>
              </section>

              <section className="admin-kpi-grid">
                <button className="admin-kpi violet" onClick={() => navigate("books")}><span className="kpi-icon">▤</span><span className="kpi-copy"><small>Total Books</small><strong>{totalInventoryCopies.toLocaleString()}</strong><em>{books.length} titles in collection</em></span><span className="kpi-spark">⌁</span></button>
                <button className="admin-kpi blue" onClick={() => navigate("members")}><span className="kpi-icon">♙</span><span className="kpi-copy"><small>Registered Members</small><strong>{approvedMembers.length.toLocaleString()}</strong><em>{pendingMembers.length} awaiting approval</em></span><span className="kpi-spark">⌁</span></button>
                <button className="admin-kpi green" onClick={() => navigate("borrow")}><span className="kpi-icon">⇄</span><span className="kpi-copy"><small>Issued Books</small><strong>{borrowedRecords.length.toLocaleString()}</strong><em>{totalAvailableCopies.toLocaleString()} copies available</em></span><span className="kpi-spark">⌁</span></button>
                <button className="admin-kpi amber" onClick={() => navigate("borrow")}><span className="kpi-icon">◷</span><span className="kpi-copy"><small>Reservations</small><strong>{reservedRecords.length.toLocaleString()}</strong><em>Current reservation records</em></span><span className="kpi-spark">⌁</span></button>
                <button className="admin-kpi rose" onClick={() => navigate("borrow")}><span className="kpi-icon">△</span><span className="kpi-copy"><small>Overdue Books</small><strong>{overdueRecords.length.toLocaleString()}</strong><em>Require follow-up</em></span><span className="kpi-spark">⌁</span></button>
              </section>

              <section className="admin-analytics-grid">
                <article className="premium-panel borrowing-chart-panel">
                  <div className="premium-panel-head"><div><h3>Borrowing Activity</h3><p>Issue activity over the last seven days</p></div><span className="panel-chip">LAST 7 DAYS</span></div>
                  <div className="activity-chart">
                    <div className="chart-y-labels"><span>{maxWeeklyActivity || 0}</span><span>{Math.ceil(maxWeeklyActivity * .66)}</span><span>{Math.ceil(maxWeeklyActivity * .33)}</span><span>0</span></div>
                    <div className="activity-bars">{weeklyActivity.map((item) => <div className="activity-bar-column" key={item.label}><div className="activity-bar-track"><span style={{ height: `${Math.max(5, item.count / maxWeeklyActivity * 100)}%` }} title={`${item.count} issued`} /></div><small>{item.label}</small></div>)}</div>
                  </div>
                </article>

                <article className="premium-panel monthly-panel">
                  <div className="premium-panel-head"><div><h3>Monthly Issue vs Return</h3><p>Circulation performance</p></div><div className="chart-legend"><span><i className="legend-issued" />Issued</span><span><i className="legend-returned" />Returned</span></div></div>
                  <div className="monthly-bars">{monthlyBorrowing.map((item) => <div className="month-column" key={item.label}><div className="month-bar-pair"><span className="issued-bar" style={{ height: `${Math.max(3, item.issues / maxMonthlyValue * 100)}%` }} title={`${item.issues} issued`} /><span className="returned-bar" style={{ height: `${Math.max(3, item.returns / maxMonthlyValue * 100)}%` }} title={`${item.returns} returned`} /></div><small>{item.label}</small></div>)}</div>
                </article>

                <article className="premium-panel category-panel">
                  <div className="premium-panel-head"><div><h3>Book Categories</h3><p>Collection distribution</p></div></div>
                  {categorySummary.length ? <div className="category-list">{categorySummary.map((item, index) => <div className="category-row" key={item.category}><span className={`category-dot category-${index}`} /><span>{item.category}</span><strong>{item.total}</strong></div>)}</div> : <EmptyState text="Category data will appear here." />}
                </article>
              </section>

              <section className="admin-lower-grid">
                <article className="premium-panel overview-panel">
                  <div className="premium-panel-head"><div><h3>Library Overview</h3><p>Current inventory status</p></div><button className="text-link" onClick={() => navigate("books")}>View books →</button></div>
                  <div className="overview-metrics">
                    <div className="overview-metric"><span className="metric-symbol mint">▤</span><div><small>Available Copies</small><strong>{totalAvailableCopies.toLocaleString()}</strong></div></div>
                    <div className="overview-metric"><span className="metric-symbol cyan">⇄</span><div><small>Borrowed Copies</small><strong>{totalBorrowedCopies.toLocaleString()}</strong></div></div>
                    <div className="overview-metric"><span className="metric-symbol red">!</span><div><small>Overdue Records</small><strong>{overdueRecords.length}</strong></div></div>
                    <div className="overview-metric"><span className="metric-symbol gold">♙</span><div><small>Pending Members</small><strong>{pendingMembers.length}</strong></div></div>
                  </div>
                </article>

                <article className="premium-panel quick-panel">
                  <div className="premium-panel-head"><div><h3>Quick Actions</h3><p>Common library operations</p></div></div>
                  <div className="quick-action-grid">
                    <button onClick={() => navigate("books")}><span className="quick-icon violet">＋</span>Add Book</button>
                    <button onClick={() => navigate("approvals")}><span className="quick-icon cyan">♙</span>Members</button>
                    <button onClick={() => navigate("borrow")}><span className="quick-icon green">⇄</span>Issue Book</button>
                    <button onClick={() => navigate("reports")}><span className="quick-icon amber">▥</span>Reports</button>
                  </div>
                </article>

                <article className="premium-panel tasks-panel">
                  <div className="premium-panel-head"><div><h3>Today's Tasks</h3><p>Items that may need attention</p></div><span className="task-count">{overdueRecords.length + pendingMembers.length}</span></div>
                  <button className="task-row" onClick={() => navigate("borrow")}><span className="task-icon red">△</span><span><strong>{overdueRecords.length} Overdue Follow-ups</strong><small>Review late returns</small></span><b>{overdueRecords.length}</b></button>
                  <button className="task-row" onClick={() => navigate("approvals")}><span className="task-icon purple">♙</span><span><strong>{pendingMembers.length} Member Approvals</strong><small>Review new registrations</small></span><b>{pendingMembers.length}</b></button>
                  <button className="task-row" onClick={() => navigate("notifications")}><span className="task-icon blue">♢</span><span><strong>{unreadNotifications} Unread Notifications</strong><small>Check library updates</small></span><b>{unreadNotifications}</b></button>
                </article>
              </section>

              <section className="admin-bottom-grid">
                <article className="premium-panel transactions-panel">
                  <div className="premium-panel-head"><div><h3>Recent Transactions</h3><p>Latest circulation records</p></div><button className="text-link" onClick={() => navigate("borrow")}>View all →</button></div>
                  <DataTable headers={["BOOK", "MEMBER", "ISSUE DATE", "DUE DATE", "STATUS"]} rows={[...records].sort((a,b) => new Date(b.borrowDate || 0) - new Date(a.borrowDate || 0)).slice(0,5).map((r) => [r.book?.title || "—", r.member?.name || "—", dateText(r.borrowDate), dateText(r.dueDate), <span className={`status-pill ${String(r.status || "").toLowerCase()}`}>{r.status || "Unknown"}</span>])} />
                  {records.length === 0 && <EmptyState text="No transactions recorded yet." />}
                </article>
                <article className="premium-panel popular-panel">
                  <div className="premium-panel-head"><div><h3>Popular Books</h3><p>Most borrowed titles in the collection</p></div><button className="text-link" onClick={() => navigate("books")}>View all →</button></div>
                  {popularBooks.length ? <div className="popular-book-list">{popularBooks.map((book, index) => <div className="popular-book-row" key={idOf(book)}><span className="popular-rank">0{index + 1}</span><div className="popular-book-info"><strong>{book.title}</strong><small>{book.author || "Unknown author"}</small></div><span className="popular-category">{book.category || "General"}</span></div>)}</div> : <EmptyState text="Add books to see your collection here." />}
                </article>
              </section>
            </div>
          )}

          {page === "books" && isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="Book Management"
                subtitle="Add, edit, search and manage books"
              />

              <form className="inline-form" onSubmit={saveBook}>
                <input
                  required
                  placeholder="Book title"
                  value={bookForm.title}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, title: e.target.value })
                  }
                />

                <input
                  required
                  placeholder="Author"
                  value={bookForm.author}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, author: e.target.value })
                  }
                />

                <input
                  required
                  placeholder="Category"
                  value={bookForm.category}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, category: e.target.value })
                  }
                />

                <input
                  required
                  placeholder="ISBN (10–13 digits)"
                  value={bookForm.isbn}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, isbn: e.target.value })
                  }
                />

                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={bookForm.quantity}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, quantity: e.target.value })
                  }
                />

                <button className="primary-button">
                  {editingBook ? "Update Book" : "Add Book"}
                </button>

                {editingBook && (
                  <button
                    type="button"
                    className="reject-button"
                    onClick={() => {
                      setEditingBook(null);
                      setBookForm({
                        title: "",
                        author: "",
                        category: "",
                        isbn: "",
                        quantity: "",
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </form>

              <BookTable
                books={filteredBooks}
                isAdmin
                onEdit={startEditBook}
                onDelete={deleteBook}
              />
            </section>
          )}

          {page === "members" && isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="Library Members"
                subtitle="Manage member accounts"
              />

              <div className="toolbar-row">
                <SearchField
                  value={memberSearch}
                  onChange={setMemberSearch}
                  placeholder="Search members..."
                />
              </div>

              <DataTable
                headers={["NAME", "EMAIL", "PHONE", "STATUS", "ACTION"]}
                rows={filteredMembers.map((m) => [
                  m.name,
                  m.email,
                  m.phone,
                  `${m.approvalStatus} / ${m.status}`,
                  <span>
                    <button
                      className="approve-button"
                      onClick={() =>
                        updateMemberStatus(
                          m,
                          m.status === "Active" ? "Inactive" : "Active"
                        )
                      }
                    >
                      {m.status === "Active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      className="reject-button"
                      onClick={() => deleteMember(m)}
                    >
                      Delete
                    </button>
                  </span>,
                ])}
              />

              {filteredMembers.length === 0 && (
                <EmptyState text="No members found." />
              )}
            </section>
          )}

          {page === "approvals" && isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="Member Approvals"
                subtitle="Review new registration requests"
              />

              {pendingMembers.length === 0 ? (
                <EmptyState text="There are no pending registrations." />
              ) : (
             <div className="approval-list">
                                  {pendingMembers.map((m) => (
                    <div className="approval-card" key={idOf(m)}>
                      <div className="member-avatar">
                        {m.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="approval-info">
                        <strong>{m.name}</strong>
                        <span>{m.email}</span>
                        <small>{m.phone} · {m.address}</small>
                      </div>

                      <div className="approval-buttons">
                        <button
                          className="approve-button"
                          onClick={() => approveMember(m)}
                        >
                          Approve
                        </button>

                        <button
                          className="reject-button"
                          onClick={() => rejectMember(m)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === "borrow" && isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="Borrow & Return"
                subtitle="Issue books and process returns"
              />

              <form className="inline-form borrow-form" onSubmit={borrowBook}>
                <select name="bookId" required defaultValue="">
                  <option value="" disabled>Select a book</option>

                  {books
                    .filter((b) => b.availableCopies > 0)
                    .map((b) => (
                      <option key={idOf(b)} value={idOf(b)}>
                        {b.title} ({b.availableCopies} available)
                      </option>
                    ))}
                </select>

                <select name="memberId" required defaultValue="">
                  <option value="" disabled>Select a member</option>

                  {approvedMembers.map((m) => (
                    <option key={idOf(m)} value={idOf(m)}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <input
                  name="dueDate"
                  type="date"
                  min={today()}
                  required
                />

                <button className="primary-button">Issue Book</button>
              </form>

              <PanelHeader
                title="Borrowing Records"
                subtitle="Active, overdue and returned transactions"
              />

              <div className="toolbar-row">
                <SearchField
                  value={recordSearch}
                  onChange={setRecordSearch}
                  placeholder="Search borrowing records..."
                />
              </div>

              <div className="approval-list">
                {records
                  .filter((r) =>
                    `${r.book?.title || ""} ${r.member?.name || ""} ${r.status}`
                      .toLowerCase()
                      .includes(recordSearch.toLowerCase())
                  )
                  .map((r) => (
                    <div className="approval-card" key={idOf(r)}>
                      <div className="approval-info">
                        <strong>{r.book?.title || "Book"}</strong>
                        <span>
                          {r.member?.name || "Member"} · Due: {dateText(r.dueDate)}
                        </span>
                        <small>Borrowed: {dateText(r.borrowDate)}</small>
                      </div>

                      <span className={`status ${r.status === "Returned" ? "available" : "borrowed"}`}>
                        {r.status}
                      </span>

                      {r.status === "Borrowed" && (
                        <button
                          className="approve-button"
                          onClick={() => returnBook(r)}
                        >
                          Mark Returned
                        </button>
                      )}
                    </div>
                  ))}

                {records.length === 0 && (
                  <EmptyState text="No borrowing records yet." />
                )}
              </div>
            </section>
          )}

          {page === "reports" && isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="Library Analytics"
                subtitle="Borrowing activity, inventory insights and performance"
                right={
                  <button className="primary-button" onClick={exportCSV}>
                    Export CSV
                  </button>
                }
              />

              <section className="stats-grid report-stats">
                <Stat title="Total Inventory" value={totalInventoryCopies} />
                <Stat title="Available Copies" value={totalAvailableCopies} />
                <Stat title="Borrowed Copies" value={totalBorrowedCopies} />
                <Stat title="Overdue Records" value={overdueRecords.length} />
              </section>

              <div className="report-analytics-grid">
                <section className="report-chart-card">
                  <div className="report-card-heading">
                    <div>
                      <h3>Borrowing Activity</h3>
                      <p>Monthly issues and returns — last 6 months</p>
                    </div>
                    <span className="report-card-icon">↗</span>
                  </div>

                  <div className="report-legend">
                    <span><i className="legend-dot issue-dot"></i> Issues</span>
                    <span><i className="legend-dot return-dot"></i> Returns</span>
                  </div>

                  <div className="monthly-chart">
                    {monthlyBorrowing.map((month) => (
                      <div className="monthly-chart-column" key={month.label}>
                        <div className="monthly-bars">
                          <div
                            className="monthly-bar issue-bar"
                            style={{
                              height: `${(month.issues / maxMonthlyValue) * 150}px`,
                            }}
                            title={`Issues: ${month.issues}`}
                          />
                          <div
                            className="monthly-bar return-bar"
                            style={{
                              height: `${(month.returns / maxMonthlyValue) * 150}px`,
                            }}
                            title={`Returns: ${month.returns}`}
                          />
                        </div>
                        <span className="monthly-chart-label">{month.label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="report-chart-card">
                  <div className="report-card-heading">
                    <div>
                      <h3>Inventory by Category</h3>
                      <p>Book copies grouped by category</p>
                    </div>
                    <span className="report-card-icon">▤</span>
                  </div>

                  {inventoryByCategory.length > 0 ? (
                    <div className="category-report-list">
                      {inventoryByCategory.map((item) => (
                        <div className="category-report-item" key={item.category}>
                          <div className="category-report-info">
                            <span>{item.category}</span>
                            <strong>{item.total} copies</strong>
                          </div>
                          <div className="category-progress-track">
                            <div
                              className="category-progress-fill"
                              style={{
                                width: `${totalInventoryCopies
                                  ? (item.total / totalInventoryCopies) * 100
                                  : 0}%`,
                              }}
                            />
                          </div>
                          <small>{item.available} available</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No inventory categories available." />
                  )}
                </section>
              </div>

              <section className="report-records-card">
                <div className="report-card-heading">
                  <div>
                    <h3>Borrowing Records</h3>
                    <p>Search and filter your library transactions</p>
                  </div>
                  <span className="report-record-count">
                    {filteredRecords.length} records
                  </span>
                </div>

                <div className="toolbar-row">
                  <SearchField
                    value={reportSearch}
                    onChange={setReportSearch}
                    placeholder="Search book or member..."
                  />

                  <label>
                    From
                    <input
                      type="date"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                    />
                  </label>

                  <label>
                    To
                    <input
                      type="date"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                    />
                  </label>
                </div>

                <DataTable
                  headers={[
                    "BOOK",
                    "MEMBER",
                    "BORROW DATE",
                    "DUE DATE",
                    "RETURN DATE",
                    "STATUS",
                  ]}
                  rows={filteredRecords.map((r) => [
                    r.book?.title || "—",
                    r.member?.name || "—",
                    dateText(r.borrowDate),
                    dateText(r.dueDate),
                    dateText(r.returnDate),
                    r.status,
                  ])}
                />

                {filteredRecords.length === 0 && (
                  <EmptyState text="No report records match these filters." />
                )}
              </section>
            </section>
          )}
                    {page === "user-dashboard" && !isAdmin && (
            <div className="member-dashboard-v2">
              <section className="member-hero">
                <div className="member-hero-copy"><span className="eyebrow">YOUR PERSONAL LIBRARY</span><h2>Welcome back, {user.name?.split(" ")[0] || "Reader"} <span>✦</span></h2><p>Your next great read is waiting. Keep track of your books and discover something new.</p><div className="member-hero-actions"><button className="hero-primary" onClick={() => navigate("catalog")}>Explore Catalogue <span>→</span></button><button className="hero-secondary" onClick={() => navigate("my-books")}>My Reading History</button></div></div>
                <div className="member-hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-book-stack"><span>BOOKS</span><i/><b/><em/></div></div>
              </section>

              <section className="member-kpi-grid">
                <article className="member-kpi purple"><span className="member-kpi-icon">▤</span><div><small>Currently Borrowed</small><strong>{memberBorrowedRecords.length}</strong><em>Books in your account</em></div></article>
                <article className="member-kpi cyan"><span className="member-kpi-icon">⌕</span><div><small>Available Titles</small><strong>{books.length}</strong><em>Explore the catalogue</em></div></article>
                <article className="member-kpi amber"><span className="member-kpi-icon">◷</span><div><small>Due This Week</small><strong>{memberDueSoonRecords.length}</strong><em>Plan your returns</em></div></article>
                <article className="member-kpi rose"><span className="member-kpi-icon">△</span><div><small>Overdue Books</small><strong>{memberOverdueRecords.length}</strong><em>{memberOverdueRecords.length ? "Please arrange a return" : "You’re all caught up"}</em></div></article>
              </section>

              <section className="member-main-grid">
                <article className="premium-panel member-borrow-panel"><div className="premium-panel-head"><div><h3>My Borrowed Books</h3><p>Your active loans and due dates</p></div><button className="text-link" onClick={() => navigate("my-books")}>View all →</button></div>
                  {memberBorrowedRecords.length ? <div className="member-loan-list">{memberBorrowedRecords.slice(0,4).map((record) => { const late = record.dueDate && new Date(record.dueDate) < new Date(); return <div className="member-loan-row" key={idOf(record)}><span className="loan-cover">▤</span><div className="loan-details"><strong>{record.book?.title || "Library book"}</strong><small>{record.book?.author || "Library collection"}</small></div><div className="loan-due"><small>{late ? "OVERDUE" : "DUE DATE"}</small><strong className={late ? "late-date" : ""}>{dateText(record.dueDate)}</strong></div></div>; })}</div> : <div className="member-empty"><span>▤</span><strong>No active loans yet</strong><p>Browse the catalogue and find your next read.</p><button onClick={() => navigate("catalog")}>Browse books →</button></div>}
                </article>

                <article className="premium-panel member-notice-panel"><div className="premium-panel-head"><div><h3>Reading Snapshot</h3><p>Your library activity</p></div></div><div className="reading-ring-wrap"><div className="reading-ring"><div><strong>{records.length}</strong><small>Total loans</small></div></div></div><div className="reading-stats"><div><span className="ring-dot active-dot"/>Returned books<strong>{records.filter((r) => r.status === "Returned").length}</strong></div><div><span className="ring-dot borrowed-dot"/>Active loans<strong>{memberBorrowedRecords.length}</strong></div><div><span className="ring-dot late-dot"/>Overdue<strong>{memberOverdueRecords.length}</strong></div></div></article>
              </section>

              <section className="member-bottom-grid">
                <article className="premium-panel member-discover-panel"><div className="premium-panel-head"><div><h3>Discover Books</h3><p>Recently added to your library</p></div><button className="text-link" onClick={() => navigate("catalog")}>Browse all →</button></div><div className="discover-book-grid">{[...books].slice(-4).reverse().map((book, index) => <button className="discover-book" key={idOf(book)} onClick={() => navigate("catalog")}><span className={`discover-cover cover-${index}`}>LIBRA<br/>FLOW</span><strong>{book.title}</strong><small>{book.author || "Unknown author"}</small><em>{book.category || "General"}</em></button>)}{books.length === 0 && <EmptyState text="New books will appear here." />}</div></article>
                <article className="premium-panel member-notifications-panel"><div className="premium-panel-head"><div><h3>Latest Updates</h3><p>Announcements from your library</p></div><button className="text-link" onClick={() => navigate("notifications")}>View all →</button></div>{notifications.slice(0,3).map((item) => <div className="member-update" key={idOf(item)}><span className="update-dot"/><div><strong>{item.title || item.subject || "Library update"}</strong><p>{item.message || item.body || item.text || "You have a new notification."}</p><small>{dateText(item.createdAt || item.created_at)}</small></div></div>)}{notifications.length === 0 && <EmptyState text="You’re all caught up. No new updates." />}</article>
              </section>
            </div>
          )}

          {page === "catalog" && !isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="Book Catalogue"
                subtitle="Browse available library books"
              />

              <BookTable books={filteredBooks} isAdmin={false} onRead={openEbook} />
            </section>
          )}

          {page === "my-books" && !isAdmin && (
            <section className="panel page-panel">
              <PanelHeader
                title="My Borrowed Books"
                subtitle="Your borrowing history"
              />

              <DataTable
                headers={[
                  "BOOK",
                  "BORROW DATE",
                  "DUE DATE",
                  "RETURN DATE",
                  "STATUS",
                ]}
                rows={records.map((r) => [
                  r.book?.title || "—",
                  dateText(r.borrowDate),
                  dateText(r.dueDate),
                  dateText(r.returnDate),
                  r.status,
                ])}
              />

              {records.length === 0 && (
                <EmptyState text="You have no borrowing records yet." />
              )}
            </section>
          )}

          {page === "notifications" && (
            <section className="panel page-panel">
              <PanelHeader
                title="Notifications"
                subtitle="Library alerts and account updates"
                right={
                  <button className="primary-button" onClick={loadNotifications}>
                    Refresh
                  </button>
                }
              />

              {isAdmin && (
                <form className="premium-form" onSubmit={createNotification}>
                  <h3>Create announcement</h3>

                  <input
                    required
                    placeholder="Notification title"
                    value={notificationForm.title}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        title: e.target.value,
                      })
                    }
                  />

                  <textarea
                    required
                    placeholder="Write your notification message..."
                    value={notificationForm.message}
                    onChange={(e) =>
                      setNotificationForm({
                        ...notificationForm,
                        message: e.target.value,
                      })
                    }
                  />

                  <div className="premium-form-row">
                    <select
                      value={notificationForm.type}
                      onChange={(e) =>
                        setNotificationForm({
                          ...notificationForm,
                          type: e.target.value,
                        })
                      }
                    >
                      <option value="info">Information</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="alert">Alert</option>
                    </select>

                    <small>Visible to library users</small>
                    <button className="primary-button">Publish</button>
                  </div>
                </form>
              )}

              <div className="notification-list">
                {notifications.map((item) => {
                  const unread = !(item.isRead || item.read);

                  return (
                    <article
                      key={idOf(item)}
                      className={`notification-card ${unread ? "is-unread" : ""}`}
                      onClick={() => markNotificationRead(item)}
                    >
                      <span className={`notification-type ${item.type || ""}`} />

                      <div>
                        <div className="notification-title-row">
                          <strong>
                            {item.title || item.subject || "Library notification"}
                          </strong>
                          <small>
                            {dateText(item.createdAt || item.created_at)}
                          </small>
                        </div>

                        <p>{item.message || item.body || item.text || ""}</p>

                        {unread && (
                          <span className="unread-label">
                            UNREAD · CLICK TO MARK AS READ
                          </span>
                        )}

                        {isAdmin && (
                          <button
                            className="reject-button"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(item);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}

                {notifications.length === 0 && (
                  <EmptyState text="No notifications yet." />
                )}
              </div>
            </section>
          )}

          {page === "profile" && (
            <section className="panel page-panel profile-panel">
              <PanelHeader
                title="My Profile"
                subtitle="Manage your account information"
              />

              <form className="profile-form" onSubmit={saveProfile}>
                <label>Full Name</label>
                <input
                  required
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />

                <label>Email Address</label>
                <input disabled value={user.email || ""} />

                <label>Phone Number</label>
                <input
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                />

                <label>Address</label>
                <input
                  value={profile.address}
                  onChange={(e) =>
                    setProfile({ ...profile, address: e.target.value })
                  }
                />

                <button className="primary-button">Save Profile</button>
              </form>

              {!isAdmin && (
                <form
                  className="profile-form password-form"
                  onSubmit={changePassword}
                >
                  <h3>Change Password</h3>

                  <label>Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                  />

                  <label>New Password</label>
                  <input
                    type="password"
                    minLength="8"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                  />

                  <button className="primary-button">Change Password</button>
                </form>
              )}
            </section>
          )}

          <footer>© 2026 LibraFlow Library Management System</footer>
        </main>
      </div>

      {message && <div className="toast">{message}</div>}
    </>
  );
    
}