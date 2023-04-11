import { memo, useContext } from 'react';
import AuthContext from './AuthContext';

const Child = memo(({ children }) => {
    const value = useContext(AuthContext);

    return (
        <div className='child' onClick={() => value.login({ id: 2 })}>
            {children}
            <br />
            <span>User ID: <b>{value.currentUserId}</b></span>
            <br />
            <span>Render ID: <b>{ Math.round(Math.random() * 100) }</b></span>
        </div>
    );
})

export { Child };