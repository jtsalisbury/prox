import events from 'events';
import logger from '../services/logger';

logger.debug('Loading event service...');

export default new events.EventEmitter();