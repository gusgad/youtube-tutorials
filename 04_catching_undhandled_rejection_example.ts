const DAL = {
    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            resolve({ id: 1, isAlive: false });
        })
    }
}

DAL.getUserById(1).then((johnSnow: {id: number, isAlive: boolean}) => {
    // this error will just vanish
    if(johnSnow.isAlive === false)
        throw new Error('ahhhh');
});

process.on('unhandledRejection', (reason: string, p: Promise<any>) => {
    // I just caught an unhandled promise rejection,
    // since we already have fallback handler for unhandled errors (see below),
    // let throw and let him handle that
    throw reason;
});
  
process.on('uncaughtException', (error: Error) => {
    console.log('We handle it here', error)
    // I just received an error that was never handled, time to handle it and then decide whether a restart is needed
    // errorManagement.handler.handleError(error);
    // if (!errorManagement.handler.isTrustedError(error))
    //   process.exit(1);
});



