import { apiHandler } from "../../server/broadcast/http.js";
import { changeBroadcastMatch } from "../../server/broadcast/match-service.js";

export default apiHandler("POST", changeBroadcastMatch);
