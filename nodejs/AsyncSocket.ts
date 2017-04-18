import { Socket } from 'net';

Socket.prototype.connectAsync = async function () {
  let _this = this;
  let socketArgs = Array.from(arguments);

  return new Promise<boolean>(resolve => {
    let errorHandler = (error: Error) => resolve(false);
    let finishHandler = () => {
      socket.removeListener('error', errorHandler);
      resolve(true);
    };

    let args = socketArgs.concat(finishHandler);
    var socket = Socket.prototype.connect.apply(_this, args);
    socket.on('error', errorHandler);
  });
}

Socket.prototype.writeAsync = async function (): Promise<boolean> {
  let _this = this;
  let socketArgs = Array.from(arguments);

  return new Promise<boolean>(resolve => {
    let finishHandler = () => resolve(flushed);
    let args = socketArgs.concat(finishHandler);
    var flushed = Socket.prototype.write.apply(_this, args);
  });
}

Socket.prototype.readAsync = async function (): Promise<Buffer> {
  let _this = <Socket>this;
  return new Promise<Buffer>((resolve, reject) => {
    let errorHandler = (err: Error) => reject(null);
    let dataHandler = (data: Buffer) => {
      _this.removeListener('error', errorHandler);
      resolve(data);
    };

    let args = ['data', dataHandler];
    Socket.prototype.once.apply(_this, args);
    _this.on('data', errorHandler);
  });
}

interface ISocketEx extends Socket {
  connectAsync(path: string): Promise<boolean>;
  connectAsync(port: number, host: string): Promise<boolean>;
  writeAsync(data: string): Promise<boolean>;
  writeAsync(data: Buffer): Promise<boolean>;
  writeAsync(data: Buffer, encoding: string): Promise<boolean>;
  readAsync(): Promise<Buffer>;
}