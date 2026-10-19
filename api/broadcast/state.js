import { apiHandler } from "../../server/broadcast/http.js";
import { readBroadcastState } from "../../server/broadcast/match-service.js";

export default apiHandler("GET", readBroadcastState);
