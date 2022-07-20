import { useContext } from "react";
import Link from "next/link";
import Router from "next/router";
import { magic } from "../lib/magic";
import { CallToAction, TextButton } from "@magiclabs/ui";
import { useUser } from "../lib/UserContext";

const Header = () => {
  const { user, setUser } = useUser();

  const logout = () => {
    if (magic) {
      magic.user.logout().then(() => {
        setUser({ user: null });
        Router.push("/login");
      });
    }
  };

  return (
    <header>
      <nav>
        <ul>
          {user?.loading ? (
            // If loading, don't display any buttons specific to the loggedIn state
            <div style={{ height: "38px" }}></div>
          ) : user?.issuer ? (
            <>
              <li>
                <Link href="/">
                  <TextButton color="primary" size="sm">
                    Home
                  </TextButton>
                </Link>
              </li>
              <li>
                <Link href="/profile">
                  <TextButton color="primary" size="sm">
                    Profile
                  </TextButton>
                </Link>
              </li>
              <li>
                <a>
                  <TextButton color="warning" size="sm" onPress={logout}>
                    Logout
                  </TextButton>
                </a>
              </li>
            </>
          ) : (
            <li>
              <Link href="/login">
                <CallToAction color="primary" size="sm">
                  Login
                </CallToAction>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <style jsx>{`
        nav {
          max-width: 45rem;
          margin: 0 auto 50px;
          padding: 1.25rem 1.25rem;
          border-bottom: 1px solid #f0f0f0;
        }
        ul {
          display: flex;
          list-style: none;
        }
        li {
          margin-right: 1.5rem;
          line-height: 38px;
        }
        li:first-child {
          margin-left: auto;
        }
      `}</style>
    </header>
  );
};

export default Header;
