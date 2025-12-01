import { useMemo, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { PermissionTypes, Permissions, LocalStorageKeys } from 'librechat-data-provider';
import FilterPrompts from '~/components/Prompts/Groups/FilterPrompts';
import DashBreadcrumb from '~/routes/Layouts/DashBreadcrumb';
import GroupSidePanel from './Groups/GroupSidePanel';
import { PromptGroupsProvider } from '~/Providers';
import { useHasAccess, useDocumentTitle, useLocalize } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { cn } from '~/utils';

export default function PromptsView() {
  const params = useParams();
  const navigate = useNavigate();
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const isDetailView = useMemo(() => !!(params.promptId || params['*'] === 'new'), [params]);
  const hasAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.USE,
  });

  // Set page title
  const appTitle =
    startupConfig?.appTitle ||
    localStorage.getItem(LocalStorageKeys.APP_TITLE) ||
    'Construct.Chat - AI-Powered Construction Intelligence & Automation';
  useDocumentTitle(`${localize('com_ui_prompts') || 'Prompts'} | ${appTitle}`);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccess) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccess, navigate]);

  if (!hasAccess) {
    return null;
  }

  return (
    <PromptGroupsProvider>
      <div className="flex h-screen w-full flex-col bg-surface-primary p-0 lg:p-2">
        <DashBreadcrumb />
        <div className="flex w-full flex-grow flex-row divide-x overflow-hidden dark:divide-gray-600">
          <GroupSidePanel isDetailView={isDetailView}>
            <div className="mt-1 flex flex-row items-center justify-between px-2 md:px-2">
              <FilterPrompts />
            </div>
          </GroupSidePanel>
          <div
            className={cn(
              'scrollbar-gutter-stable w-full overflow-y-auto lg:w-3/4 xl:w-3/4',
              isDetailView ? 'block' : 'hidden md:block',
            )}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </PromptGroupsProvider>
  );
}
