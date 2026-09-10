import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import get_current_user
from ..core.erp_settings import PLAN_LABELS, PLAN_MODULES, infer_plan, modules_for_plan
from ..database import get_db
from ..models.user import User, Workspace

router = APIRouter(prefix='/admin/erp', tags=['ERP Admin'])


def _require_super_admin(current_user: User):
    if not current_user.is_super_admin:
        raise HTTPException(403, 'Super-admin access required')


class ApplyPlanBody(BaseModel):
    plan: str


@router.get('/plans')
async def list_plans(current_user: User = Depends(get_current_user)):
    _require_super_admin(current_user)
    return [
        {
            'key': key,
            'label': PLAN_LABELS[key],
            'modules': modules,
            'module_count': len(modules),
        }
        for key, modules in PLAN_MODULES.items()
    ]


@router.get('/workspaces/{workspace_id}/plan')
async def get_workspace_plan(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_super_admin(current_user)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(404, 'Workspace not found')
    try:
        modules = json.loads(workspace.enabled_modules)
    except Exception:
        modules = []
    return {
        'workspace_id': workspace.id,
        'plan': infer_plan(modules),
        'modules': modules,
    }


@router.patch('/workspaces/{workspace_id}/plan')
async def apply_workspace_plan(
    workspace_id: int,
    body: ApplyPlanBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_super_admin(current_user)
    try:
        modules = modules_for_plan(body.plan)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(404, 'Workspace not found')

    workspace.enabled_modules = json.dumps(modules)
    await db.commit()

    return {
        'workspace_id': workspace.id,
        'slug': workspace.slug,
        'plan': body.plan.lower(),
        'enabled_modules': modules,
    }
