import { io } from 'socket.io-client';
import { BACKEND } from './config';

const socket = io(BACKEND, { autoConnect: false });

export default socket;
