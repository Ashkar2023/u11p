import { apiHandler } from "../../server/broadcast/http.js";
import { broadcastService } from "../../server/broadcast/service.js";

export default apiHandler("GET", broadcastService.session);
