import Link from "next/link";

export default function Navbar() {
    return (
        <header>
            <nav className="navbar-container" role="navigation" aria-label="main-navigation">
                <div>
                    <a href="#">
                        <img src="null" alt="home logo" />
                    </a>
            </div>
            <div className="menu">
                <ul>
                    <li>
                        <a href="/">Home</a>
                    </li>
                     <li>
                        <a href="/">Invoices</a>
                    </li>
                     <li>
                        <a href="/">Users</a>
                    </li>
                     <li>
                        <a href="/">Properties</a>
                    </li>
                    <li>
                        <a href="/">payments</a>
                    </li>
                    <li>
                        <a href="/">Reports</a>
                    </li>
                </ul>
            </div>
            <div className="nav-right">
                <button className="demo-booking">
                    Book a free demo
                </button>
                <a href="">Contact</a>
                <div className="navbar-mobile" aria-label="toggle-menu">
                    <button className="mobileBtn">
                            <img className="icon-open" src="null" alt="icon open"/>
                            <img className="icon-close" src="null" alt="icon close"/>
                    </button>
                </div>
            </div>
        </nav>
</header>
    );
}