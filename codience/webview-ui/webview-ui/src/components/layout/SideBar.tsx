import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import "../styles/SideBar.css";
import logo from "../../assets/codience logo (3).png";
import { clearPRState } from "../../hooks/usePRs";

const SideBar = () => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearPRState();
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="sideBar">
      <img src={logo} alt="Codience Logo" className="logo" />

      <nav className="navBar">
        <NavLink to="/home">Home</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        <NavLink to="/getRepo">Change Repo</NavLink>
      </nav>

      <button className="signOut" type="button" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
};

export default SideBar;
