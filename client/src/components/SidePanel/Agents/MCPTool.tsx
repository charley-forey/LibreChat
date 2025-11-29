import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as Ariakit from '@ariakit/react';
import { ChevronDown, Search, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Constants } from 'librechat-data-provider';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  Label,
  Checkbox,
  OGDialog,
  Accordion,
  TrashIcon,
  AccordionItem,
  CircleHelpIcon,
  OGDialogTrigger,
  AccordionContent,
  OGDialogTemplate,
} from '@librechat/client';
import type { AgentForm, MCPServerInfo } from '~/common';
import { useLocalize, useMCPServerManager, useRemoveMCPTool } from '~/hooks';
import MCPServerStatusIcon from '~/components/MCP/MCPServerStatusIcon';
import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
import { cn } from '~/utils';

// Semantic search function - calculates relevance score for tools
function calculateToolRelevanceScore(
  tool: { metadata: { name?: string; description?: string } },
  query: string,
): number {
  if (!query.trim()) return 100;

  const queryLower = query.trim().toLowerCase();
  const name = tool.metadata.name?.toLowerCase() || '';
  const description = tool.metadata.description?.toLowerCase() || '';

  let maxScore = 0;

  // Check name matches
  if (name) {
    if (name === queryLower) {
      maxScore = Math.max(maxScore, 100); // Exact match
    } else if (name.startsWith(queryLower)) {
      maxScore = Math.max(maxScore, 80); // Starts with
    } else if (name.includes(queryLower)) {
      maxScore = Math.max(maxScore, 60); // Contains
    } else {
      // Check for word matches
      const nameWords = name.split(/\s+/);
      const queryWords = queryLower.split(/\s+/);
      const matchingWords = queryWords.filter((qw) =>
        nameWords.some((nw) => nw.startsWith(qw) || nw.includes(qw)),
      );
      if (matchingWords.length > 0) {
        maxScore = Math.max(maxScore, 40 + matchingWords.length * 5); // Partial word matches
      }
    }
  }

  // Check description matches (weighted lower than name)
  if (description) {
    if (description.includes(queryLower)) {
      maxScore = Math.max(maxScore, 30); // Description contains query
    } else {
      // Check for word matches in description
      const descWords = description.split(/\s+/);
      const queryWords = queryLower.split(/\s+/);
      const matchingWords = queryWords.filter((qw) =>
        descWords.some((dw) => dw.startsWith(qw) || dw.includes(qw)),
      );
      if (matchingWords.length > 0) {
        maxScore = Math.max(maxScore, 20 + matchingWords.length * 3); // Partial word matches in description
      }
    }
  }

  return maxScore;
}

export default function MCPTool({ serverInfo }: { serverInfo?: MCPServerInfo }) {
  const localize = useLocalize();
  const { removeTool } = useRemoveMCPTool();
  const { getValues, setValue } = useFormContext<AgentForm>();
  const { getServerStatusIconProps, getConfigDialogProps } = useMCPServerManager();

  const [isFocused, setIsFocused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  if (!serverInfo) {
    return null;
  }

  const currentServerName = serverInfo.serverName;

  const getSelectedTools = () => {
    if (!serverInfo?.tools) return [];
    const formTools = getValues('tools') || [];
    return serverInfo.tools.filter((t) => formTools.includes(t.tool_id)).map((t) => t.tool_id);
  };

  const updateFormTools = (newSelectedTools: string[]) => {
    const currentTools = getValues('tools') || [];
    const otherTools = currentTools.filter(
      (t: string) => !serverInfo?.tools?.some((st) => st.tool_id === t),
    );
    setValue('tools', [...otherTools, ...newSelectedTools]);
  };

  const selectedTools = getSelectedTools();
  const isExpanded = accordionValue === currentServerName;

  const statusIconProps = getServerStatusIconProps(currentServerName);
  const configDialogProps = getConfigDialogProps();

  // Filter and sort tools based on search query, with selected tools at the top
  const filteredTools = useMemo(() => {
    if (!serverInfo?.tools) return [];

    const hasSearchQuery = searchQuery.trim().length > 0;

    // Calculate scores for all tools if searching, and track original index
    const toolsWithScores = serverInfo.tools.map((tool, index) => ({
      tool,
      score: hasSearchQuery ? calculateToolRelevanceScore(tool, searchQuery) : 0,
      isSelected: selectedTools.includes(tool.tool_id),
      originalIndex: index,
    }));

    // Filter out tools with score 0 if searching
    const filtered = hasSearchQuery
      ? toolsWithScores.filter(({ score }) => score > 0)
      : toolsWithScores;

    // Sort: selected tools first, then by relevance score (if searching) or original order
    return filtered
      .sort((a, b) => {
        // First, prioritize selected tools
        if (a.isSelected !== b.isSelected) {
          return a.isSelected ? -1 : 1;
        }
        // If both have same selection status, sort by relevance score (if searching)
        if (hasSearchQuery && a.score !== b.score) {
          return b.score - a.score;
        }
        // Maintain original order if not searching or same score
        return a.originalIndex - b.originalIndex;
      })
      .map(({ tool }) => tool);
  }, [serverInfo?.tools, searchQuery, selectedTools]);

  // Focus search input when search is activated
  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  // Clear search when accordion is closed
  useEffect(() => {
    if (!isExpanded) {
      setSearchQuery('');
      setIsSearchActive(false);
    }
  }, [isExpanded]);

  const statusIcon = statusIconProps && (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
      className="cursor-pointer rounded p-0.5 hover:bg-surface-secondary"
    >
      <MCPServerStatusIcon {...statusIconProps} />
    </div>
  );

  return (
    <OGDialog>
      <Accordion type="single" value={accordionValue} onValueChange={setAccordionValue} collapsible>
        <AccordionItem value={currentServerName} className="group relative w-full border-none">
          <div
            className="relative flex w-full items-center gap-1 rounded-lg p-1 hover:bg-surface-primary-alt"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setIsFocused(false);
              }
            }}
          >
            <AccordionPrimitive.Header asChild>
              <div
                className="flex grow cursor-pointer select-none items-center gap-1 rounded bg-transparent p-0 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                onClick={() =>
                  setAccordionValue((prev) => {
                    if (prev) {
                      return '';
                    }
                    return currentServerName;
                  })
                }
              >
                {statusIcon && <div className="flex items-center">{statusIcon}</div>}

                {serverInfo.metadata.icon && (
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
                    <div
                      className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-center bg-no-repeat dark:bg-white/20"
                      style={{
                        backgroundImage: `url(${serverInfo.metadata.icon})`,
                        backgroundSize: 'cover',
                      }}
                    />
                  </div>
                )}
                <div
                  className="grow px-2 py-1.5"
                  style={{ textOverflow: 'ellipsis', wordBreak: 'break-all', overflow: 'hidden' }}
                >
                  {currentServerName}
                </div>
                <div className="flex items-center">
                  <div className="relative flex items-center">
                    <div
                      className={cn(
                        'absolute right-0 transition-all duration-300',
                        isHovering || isFocused
                          ? 'translate-x-0 opacity-100'
                          : 'translate-x-8 opacity-0',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          data-checkbox-container
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        >
                          <Checkbox
                            id={`select-all-${currentServerName}`}
                            checked={
                              selectedTools.length === serverInfo.tools?.length &&
                              selectedTools.length > 0
                            }
                            onCheckedChange={(checked) => {
                              if (serverInfo.tools) {
                                const newSelectedTools = checked
                                  ? serverInfo.tools.map((t) => t.tool_id)
                                  : [
                                      `${Constants.mcp_server}${Constants.mcp_delimiter}${currentServerName}`,
                                    ];
                                updateFormTools(newSelectedTools);
                              }
                            }}
                            className={cn(
                              'h-4 w-4 rounded border border-border-medium transition-all duration-200 hover:border-border-heavy',
                              isExpanded ? 'visible' : 'pointer-events-none invisible',
                            )}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                const checkbox = e.currentTarget as HTMLButtonElement;
                                checkbox.click();
                              }
                            }}
                            tabIndex={isExpanded ? 0 : -1}
                            aria-label={
                              selectedTools.length === serverInfo.tools?.length &&
                              selectedTools.length > 0
                                ? localize('com_ui_deselect_all')
                                : localize('com_ui_select_all')
                            }
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Search button - only show when expanded */}
                          {isExpanded && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSearchActive(!isSearchActive);
                                if (!isSearchActive) {
                                  setTimeout(() => {
                                    searchInputRef.current?.focus();
                                  }, 0);
                                } else {
                                  setSearchQuery('');
                                }
                              }}
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded transition-colors duration-200 hover:bg-surface-active-alt focus:translate-x-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                                isSearchActive && 'bg-surface-active-alt',
                              )}
                              aria-label={localize('com_ui_search')}
                              tabIndex={0}
                              onFocus={() => setIsFocused(true)}
                            >
                              <Search className="h-4 w-4" />
                            </button>
                          )}

                          {/* Caret button for accordion */}
                          <AccordionPrimitive.Trigger asChild>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded transition-colors duration-200 hover:bg-surface-active-alt focus:translate-x-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                                isExpanded && 'bg-surface-active-alt',
                              )}
                              aria-label={
                                isExpanded
                                  ? localize('com_ui_collapse') || 'Collapse'
                                  : localize('com_ui_expand') || 'Expand'
                              }
                              tabIndex={0}
                              onFocus={() => setIsFocused(true)}
                            >
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 transition-transform duration-200',
                                  isExpanded && 'rotate-180',
                                )}
                              />
                            </button>
                          </AccordionPrimitive.Trigger>

                          <OGDialogTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded transition-colors duration-200',
                                'hover:bg-surface-active-alt focus:translate-x-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                              )}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Delete ${currentServerName}`}
                              tabIndex={0}
                              onFocus={() => setIsFocused(true)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </OGDialogTrigger>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionPrimitive.Header>
          </div>

          <AccordionContent className="relative ml-1 pt-1 before:absolute before:bottom-2 before:left-0 before:top-0 before:w-0.5 before:bg-border-medium">
            {/* Search input - only show when search is active */}
            {isSearchActive && (
              <div className="mb-2 ml-2 mr-1">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-4 w-4 text-text-secondary" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        setIsSearchActive(false);
                      }
                    }}
                    placeholder={localize('com_ui_search_tools') || 'Search tools...'}
                    className="border-token-border-light bg-token-surface-secondary text-token-text-primary h-9 w-full rounded-lg border pl-9 pr-9 text-sm outline-none placeholder:text-text-secondary-alt focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 flex h-5 w-5 items-center justify-center rounded text-text-secondary hover:bg-surface-active-alt"
                      aria-label={localize('com_ui_clear') || 'Clear search'}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <div className="mt-1 text-xs text-text-secondary">
                    {filteredTools.length === 0
                      ? localize('com_ui_no_results') || 'No results found'
                      : `${filteredTools.length} ${filteredTools.length === 1 ? 'tool' : 'tools'} found`}
                  </div>
                )}
              </div>
            )}

            {/* Scrollable container for tools list */}
            <div className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
              {filteredTools.length === 0 && searchQuery ? (
                <div className="ml-2 mr-1 py-4 text-center text-sm text-text-secondary">
                  {localize('com_ui_no_results') || 'No tools found matching your search'}
                </div>
              ) : (
                filteredTools.map((subTool) => (
                <label
                  key={subTool.tool_id}
                  htmlFor={subTool.tool_id}
                  className={cn(
                    'border-token-border-light hover:bg-token-surface-secondary flex cursor-pointer items-center rounded-lg border p-2',
                    'ml-2 mr-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseEnter={() => setHoveredToolId(subTool.tool_id)}
                  onMouseLeave={() => setHoveredToolId(null)}
                >
                  <Checkbox
                    id={subTool.tool_id}
                    checked={selectedTools.includes(subTool.tool_id)}
                    onCheckedChange={(_checked) => {
                      const newSelectedTools = selectedTools.includes(subTool.tool_id)
                        ? selectedTools.filter((t) => t !== subTool.tool_id)
                        : [...selectedTools, subTool.tool_id];
                      updateFormTools(newSelectedTools);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const checkbox = e.currentTarget as HTMLButtonElement;
                        checkbox.click();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'relative float-left mr-2 inline-flex h-4 w-4 cursor-pointer rounded border border-border-medium transition-[border-color] duration-200 hover:border-border-heavy focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                    )}
                    aria-label={subTool.metadata.name}
                  />
                  <span className="text-token-text-primary select-none">
                    {subTool.metadata.name}
                  </span>
                  {subTool.metadata.description && (
                    <Ariakit.HovercardProvider placement="left-start">
                      <div className="ml-auto flex h-6 w-6 items-center justify-center">
                        <Ariakit.HovercardAnchor
                          render={
                            <Ariakit.Button
                              className={cn(
                                'flex h-5 w-5 cursor-help items-center rounded-full text-text-secondary transition-opacity duration-200',
                                hoveredToolId === subTool.tool_id ? 'opacity-100' : 'opacity-0',
                              )}
                              aria-label={localize('com_ui_tool_info')}
                            >
                              <CircleHelpIcon className="h-4 w-4" />
                              <Ariakit.VisuallyHidden>
                                {localize('com_ui_tool_info')}
                              </Ariakit.VisuallyHidden>
                            </Ariakit.Button>
                          }
                        />
                        <Ariakit.HovercardDisclosure
                          className="rounded-full text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label={localize('com_ui_tool_more_info')}
                          aria-expanded={hoveredToolId === subTool.tool_id}
                          aria-controls={`tool-description-${subTool.tool_id}`}
                        >
                          <Ariakit.VisuallyHidden>
                            {localize('com_ui_tool_more_info')}
                          </Ariakit.VisuallyHidden>
                          <ChevronDown className="h-4 w-4" />
                        </Ariakit.HovercardDisclosure>
                      </div>
                      <Ariakit.Hovercard
                        id={`tool-description-${subTool.tool_id}`}
                        gutter={14}
                        shift={40}
                        flip={false}
                        className="z-[999] w-80 scale-95 rounded-2xl border border-border-medium bg-surface-secondary p-4 text-text-primary opacity-0 shadow-md transition-all duration-200 data-[enter]:scale-100 data-[leave]:scale-95 data-[enter]:opacity-100 data-[leave]:opacity-0"
                        portal={true}
                        unmountOnHide={true}
                        role="tooltip"
                        aria-label={subTool.metadata.description}
                      >
                        <div className="space-y-2">
                          <p className="text-sm text-text-secondary">
                            {subTool.metadata.description}
                          </p>
                        </div>
                      </Ariakit.Hovercard>
                    </Ariakit.HovercardProvider>
                  )}
                </label>
                ))
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <OGDialogTemplate
        showCloseButton={false}
        title={localize('com_ui_delete_tool')}
        mainClassName="px-0"
        className="max-w-[450px]"
        main={
          <Label className="text-left text-sm font-medium">
            {localize('com_ui_delete_tool_confirm')}
          </Label>
        }
        selection={{
          selectHandler: () => removeTool(currentServerName),
          selectClasses:
            'bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-800 transition-color duration-200 text-white',
          selectText: localize('com_ui_delete'),
        }}
      />
      {configDialogProps && <MCPConfigDialog {...configDialogProps} />}
    </OGDialog>
  );
}
