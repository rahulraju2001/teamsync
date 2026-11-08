
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  Menu,
  User,
  Settings,
  LogOut,
  BellRing,
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";

function Navbar({ isCollapsed, setIsCollapsed, setIsMobileOpen }) {
  const { currentUser } = useWorkspace();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const profileRef = useRef(null);
  const notificationsRef = useRef(null);

  const navigate = useNavigate();

  const userInitials =
    (currentUser?.name || "User")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setIsProfileOpen(false);
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleProfile = () => {
    setIsProfileOpen((prev) => !prev);
    setIsNotificationsOpen(false);
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen((prev) => !prev);
    setIsProfileOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsProfileOpen(false);
    navigate("/login");
  };

  const handleSettings = () => {
    setIsProfileOpen(false);
    navigate("/settings");
  };

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            if (window.innerWidth >= 1024) {
              setIsCollapsed(!isCollapsed);
            } else {
              setIsMobileOpen(true);
            }
          }}
          className="text-body hover:text-heading"
          aria-label="Toggle sidebar"
        >
          <Menu size={22} />
        </button>

        <h2 className="text-lg font-semibold text-heading">
          Workspace
        </h2>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={toggleNotifications}
            className="relative text-body hover:text-heading p-1"
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
          >
            <Bell size={21} />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white border border-border rounded-xl shadow-lg z-50">
              {/* Notification header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-heading text-sm">
                  Notifications
                </h3>

                <span className="text-xs text-muted">
                  0 unread
                </span>
              </div>

              {/* Empty state */}
              <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <BellRing size={22} className="text-indigo-500" />
                </div>

                <p className="text-sm font-medium text-heading">
                  You're all caught up!
                </p>

                <p className="text-xs text-muted mt-1 max-w-52">
                  You don't have any notifications right now.
                  We'll let you know when something happens.
                </p>
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-3 text-center">
                <p className="text-xs text-muted">
                  TeamSync Notifications
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={toggleProfile}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50 transition"
            aria-label="Open profile menu"
            aria-expanded={isProfileOpen}
          >
            <div
              className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold"
              title={currentUser?.name || "User"}
            >
              {userInitials}
            </div>

            <ChevronDown
              size={16}
              className={`text-body hidden sm:block transition-transform ${
                isProfileOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-lg py-2 z-50">
              {/* User information */}
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-heading truncate">
                  {currentUser?.name || "User"}
                </p>

                <p className="text-xs text-muted truncate">
                  {currentUser?.email || ""}
                </p>
              </div>

              {/* Menu items */}
              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-body hover:bg-slate-50 transition"
              >
                <User size={17} />
                Profile & Settings
              </button>

              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-body hover:bg-slate-50 transition"
              >
                <Settings size={17} />
                Account Settings
              </button>

              <div className="border-t border-border my-2" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
              >
                <LogOut size={17} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
