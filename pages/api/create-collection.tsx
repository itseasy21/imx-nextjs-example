import { magic } from "../../lib/magic";

export default async function createCollection(req, res) {
  try {
    // const didToken = req.headers.authorization.substr(7);
    // await magic.token.validate(didToken);
    console.log(req.body);
    // const user = magic.;
    res.status(200).json({ authenticatee: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
