import { useContext } from "react";
import { UserContext, useUser } from "../lib/UserContext";
import Loading from "../components/loading";

const Home = () => {
  const { user } = useUser();

  return (
    <>
      {user?.loading ? (
        <Loading />
      ) : (
        user?.issuer && <div>You're logged in!</div>
      )}
    </>
  );
};

export default Home;
