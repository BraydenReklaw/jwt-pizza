import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import View from "./view";
import { pizzaService } from "../service/service";
import { User } from "../service/pizzaService";

export default function DeleteUser() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = (location.state as { user: User })?.user;

  async function confirmDelete() {
    if (!user) return;
    await pizzaService.deleteUser(user);
    navigate("/admin-dashboard");
  }

  function cancel() {
    navigate("/admin-dashboard");
  }

  if (!user) {
    return (
      <View title="Delete User">
        <div className="text-center text-gray-700 py-10">User not found.</div>
      </View>
    );
  }

  return (
    <View title="Delete User">
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Delete {user.name}?
        </h2>
        <p className="text-gray-600 mb-6">
          Are you sure you want to permanently delete this user? This action
          cannot be undone.
        </p>

        <div className="flex justify-center gap-4">
          <button
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            onClick={confirmDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </View>
  );
}