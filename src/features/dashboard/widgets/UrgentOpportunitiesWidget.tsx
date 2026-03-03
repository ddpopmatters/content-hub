import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '../../../components/ui';

interface UrgentOpportunitiesWidgetProps {
  urgentOpenCount: number;
  onOpenOpportunities: () => void;
}

export function UrgentOpportunitiesWidget({
  urgentOpenCount,
  onOpenOpportunities,
}: UrgentOpportunitiesWidgetProps): React.ReactElement {
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base text-ocean-900">Urgent Opportunities</CardTitle>
          {urgentOpenCount > 0 ? (
            <Badge variant="danger">{urgentOpenCount} urgent</Badge>
          ) : (
            <Badge variant="secondary">Clear</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 py-4">
        <p className="text-sm text-graystone-600">
          Unacted high-urgency opportunities waiting for a content response.
        </p>
        <Button variant="outline" size="sm" onClick={onOpenOpportunities}>
          Open radar
        </Button>
      </CardContent>
    </Card>
  );
}

export default UrgentOpportunitiesWidget;
