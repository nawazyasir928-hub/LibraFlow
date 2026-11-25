
const API_URL = "http://localhost:5000/api";
const TOKEN_KEY = "libraflow-token";

// Common API request function
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  let response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      "Unable to connect to the server. Please check your backend."
    );
  }

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Invalid server response." };
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

// Convert MongoDB book into frontend book format
function formatBook(book) {
  return {
    ...book,
    id: book._id || book.id,
    available: book.availableCopies,
  };
}

// Get all books
export async function getBooks() {
  const books = await apiRequest("/books");

  if (!Array.isArray(books)) {
    throw new Error("Invalid books response from server.");
  }

  return books.map(formatBook);
}

// Add a new book
export async function addBook(book) {
  const quantity = Number(book.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Book quantity must be a positive whole number.");
  }

  const savedBook = await apiRequest("/books", {
    method: "POST",
    body: JSON.stringify({
      ...book,
      quantity,
      availableCopies: quantity,
    }),
  });

  return formatBook(savedBook);
}

// Update an existing book
export async function updateBook(id, book) {
  if (!id) {
    throw new Error("Book ID is required.");
  }

  const updatedBook = await apiRequest(`/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(book),
  });

  return formatBook(updatedBook);
}

// Delete a book
export async function deleteBook(id) {
  if (!id) {
    throw new Error("Book ID is required.");
  }

  await apiRequest(`/books/${id}`, {
    method: "DELETE",
  });

  return true;
}

// Export common API request function for other modules
export { apiRequest };