// Route controller
try {
    customerService.addNew(req.body).then((result: Result) => {
        res.status(200).json(result);
    }).catch((error: Error) => {
        next(throw new AppError(403, 'Forbidden', 'Customer cannot add an item at this point', true, true));
    });
}
catch (error) {
    next(throw new AppError(403, 'Forbidden', 'Customer cannot add an item at this point', true, true));
}

// Error handling middleware
app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
    handler.handleError(err, req)
});









class ErrorHandler {
    public async handleError(error: Error, responseStream: Response): Promise<void> {
        await logger.logError(error);
        await fireMonitoringMetric(error);
        await crashIfUntrustedErrorOrSendResponse(error, responseStream);
    };
}

export const handler = new ErrorHandler();