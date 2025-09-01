import logging

def configure_logging():
    """Configure logging for the application."""
    logging.basicConfig(
        level=logging.INFO,  # Set the default logging level
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    class CustomFormatter(logging.Formatter):
        LEVEL_COLORS = {
            logging.INFO: '\033[32m',    # Green
            logging.WARNING: '\033[33m', # Yellow
            logging.ERROR: '\033[31m',   # Red
            logging.CRITICAL: '\033[41m', # Red background
        }
        RESET_COLOR = '\033[0m'

        def format(self, record):
            log_color = self.LEVEL_COLORS.get(record.levelno, self.RESET_COLOR)
            message = super().format(record)
            return f"{log_color}{message}{self.RESET_COLOR}"

    handler = logging.StreamHandler()
    handler.setFormatter(CustomFormatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    root_logger = logging.getLogger()
    root_logger.handlers = []
    root_logger.addHandler(handler)

configure_logging()
logger = logging.getLogger(__name__)