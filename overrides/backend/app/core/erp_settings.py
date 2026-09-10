CORE_MODULES = [
    'projects', 'tasks', 'notes', 'contacts', 'chat', 'files',
]

PAID_MODULES = [
    'team', 'invoices', 'quotations', 'accounting', 'products', 'purchases',
    'calendar', 'hr', 'attendance', 'crm', 'sales', 'expenses',
    'inventory', 'performance', 'automation', 'helpdesk',
]

ALL_ERP_MODULES = CORE_MODULES + PAID_MODULES

PLAN_MODULES = {
    'starter': [
        'projects', 'tasks', 'contacts',
        'crm', 'quotations', 'sales', 'invoices',
    ],
    'business': [
        'projects', 'tasks', 'contacts',
        'crm', 'quotations', 'sales', 'invoices',
        'products', 'purchases', 'inventory', 'expenses', 'accounting',
    ],
    'pro': [
        'projects', 'tasks', 'notes', 'contacts', 'chat', 'files',
        'team', 'invoices', 'quotations', 'accounting', 'products', 'purchases',
        'calendar', 'hr', 'attendance', 'crm', 'sales', 'expenses',
        'inventory', 'performance', 'automation', 'helpdesk',
    ],
    'enterprise': ALL_ERP_MODULES,
}

PLAN_LABELS = {
    'starter': 'Starter',
    'business': 'Business',
    'pro': 'Pro',
    'enterprise': 'Enterprise',
}


def modules_for_plan(plan: str) -> list[str]:
    key = (plan or '').strip().lower()
    if key not in PLAN_MODULES:
        raise ValueError(f'Unknown ERP plan: {plan}')
    return list(PLAN_MODULES[key])


def infer_plan(modules: list[str]) -> str | None:
    current = set(modules or [])
    for key, plan_modules in PLAN_MODULES.items():
        if current == set(plan_modules):
            return key
    return None
