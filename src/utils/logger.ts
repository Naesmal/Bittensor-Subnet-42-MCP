import winston from "winston";

// Define log level from environment variable or default to 'info'
const logLevel = (process.env.LOG_LEVEL || "info").toLowerCase();

// Create the logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "mcp-blockchain-server" },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            
            // Include metadata if any
            if (Object.keys(metadata).length > 0 && metadata.service) {
              const metadataStr = JSON.stringify(metadata);
              if (metadataStr !== '{"service":"mcp-blockchain-server"}') {
                msg += ` ${metadataStr}`;
              }
            }
            
            return msg;
          }
        )
      ),
    }),
    
    // Log to file
    new winston.transports.File({ 
      filename: "mcp-blockchain-server-error.log", 
      level: "error" 
    }),
    new winston.transports.File({ 
      filename: "mcp-blockchain-server.log" 
    }),
  ],
});

// Provide a way to add additional transports later if needed
export const addLogTransport = (transport: winston.transport): void => {
  logger.add(transport);
};