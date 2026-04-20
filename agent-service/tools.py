import httpx
import json

ORDERS_URL = 'http://localhost:3001'
USERS_URL = 'http://localhost:3002'
PAYMENTS_URL = 'http://localhost:3003'

tools_def = [
    {
        'name': 'get_orders',
        'description': 'Fetch all orders from the Orders service. No parameters needed.',
        'parameters': {},
    },
    {
        'name': 'get_users',
        'description': 'Fetch all users from the Users service. No parameters needed.',
        'parameters': {},
    },
    {
        'name': 'create_payment',
        'description': 'Create a payment via the Payments service. Requires an object with amount, currency (optional, defaults to USD), from, and to fields.',
        'parameters': {
            'amount': 'number — payment amount',
            'currency': 'string — currency code (optional, defaults to USD)',
            'from': 'string — payer identifier',
            'to': 'string — payee identifier',
        },
    },
]


def get_tool(name):
    """Look up a tool by name."""
    return next((t for t in tools_def if t['name'] == name), None)


async def execute_tool(name, params=None):
    """Execute a tool by name."""
    params = params or {}
    
    if name == 'get_orders':
        async with httpx.AsyncClient() as client:
            resp = await client.get(f'{ORDERS_URL}/orders')
            return resp.json()
    
    elif name == 'get_users':
        async with httpx.AsyncClient() as client:
            resp = await client.get(f'{USERS_URL}/users')
            return resp.json()
    
    elif name == 'create_payment':
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f'{PAYMENTS_URL}/payments',
                json=params,
                headers={'Content-Type': 'application/json'},
            )
            return resp.json()
    
    else:
        raise ValueError(f'Unknown tool: {name}')


def tool_descriptions():
    """Return tool descriptions formatted for the LLM prompt."""
    return [
        {
            'name': t['name'],
            'description': t['description'],
            'parameters': t['parameters'],
        }
        for t in tools_def
    ]
