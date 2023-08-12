const productToAdd = undefined;

/* Bad */
// if (!productToAdd) {
//   throw ('How can I add new product when no value provided?');
// }



/* Okayish */
// if (!productToAdd) {
//   throw new Error('How can I add new product when no value provided?');
// }




















/* Best */
type HttpCode = 200 | 300 | 404 | 500;
const commonErrorsDict: {resourceNotFound: string, notFound: HttpCode} = {
  resourceNotFound: 'Resource not found',
  notFound: 404,
}

// centralized error object that derives from Node’s Error
export class AppError extends Error {
    public readonly name: string;
    public readonly httpCode: HttpCode;
    public readonly isOperational: boolean;
  
    constructor(name: string, httpCode: HttpCode, description: string, isOperational: boolean) {
      super(description);
  
      Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
  
      this.name = name;
      this.httpCode = httpCode;
      this.isOperational = isOperational;
  
      Error.captureStackTrace(this);
    }
}


/* Best */
if (!productToAdd) {
  throw new AppError(commonErrorsDict.resourceNotFound, commonErrorsDict.notFound, 'Due to the mismatch between the client defined user and existing users in the database...', true); 
}