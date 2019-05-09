var widgets = require('@jupyter-widgets/base');

import * as d3 from 'd3';

var sourceCredChartModel = widgets.DOMWidgetModel.extend({
	defaults:_.extend(_.result(this, 'widgets.DOMWidgetModel.prototype.defaults'),{
		_model_name: 'sourceCredChartModel',
		_view_name: 'sourceCredChartView',
		_model_module: 'pySourceCredChart',
		_view_module: 'pySourceCredChart',
	})
});

var sourceCredChartView = widgets.DOMWidgetView.extend({
	render: function(){
		var that = this;
		/// set up chart space without data
		this.chartContainer = d3.select(this.el);
		
		var message = new Promise(function(resolve, reject){
			resolve(that.model.get('_model_msg'))
		});
		
		message
			.then(this.message_changed())
			.catch(function(err){
				console.log(err); 
				});
		
		this.model.on('change:_model_msg', this.message_changed, this);
		this.model.on('change:_model_data', this.data_changed, this);
	},
	
	message_changed: function(){
		this.el.msg = this.model.get('_model_msg');
		this.draw(this.el.msg[0]);
	},
	
	data_changed: function(){
		this.el.data = this.model.get('_model_data');
		this.update(this.el.data);
	},
	draw: function(opts){
		console.log(opts);
		this.data = opts.data;
		this.scores = opts.scores;
		this.mapping = opts.mapping;
		this.options = opts.options;
		console.log(this.data);
		console.log(this.mapping);
		
		//preserve context for closures
		var that = this;
		
		// define dimensions
		this.width = 800;
		this.height = 600;
		
		// set up parent element and SVG
		this.chartContainer.innerHTML = '';
		this.svg = this.chartContainer.append('svg');
		this.svg.attr('width', this.width);
		this.svg.attr('height', this.height);
		this.chart = this.svg
			.append("g")
			.attr("transform", "translate(" + this.width / 2 + "," + this.height / 2 + ")")
			
		// set up svg defs
		this.chart.append("defs").append("marker")
				.attr("id", "arrow")
				.attr("viewBox", "0 -3 10 10")
				.attr("refX", 18)
				.attr("refY", 0)
				.attr("markerWidth", 5)
				.attr("markerHeight", 5)
				.attr("orient", "auto")
				.append("svg:path")
				.attr("d", "M 0,-5 L 10 ,0 L 0,5");   
		
		//chart elements        
		this.edge = this.chart.append("g");
		this.node = this.chart.append("g");
		this.tooltip = d3.select(this.element).append("div")
			.attr("class", "toolTip")
			.style('display', 'none')
			.style('position', 'absolute')
			.style('min-width' , '50px')
			.style('height', 'auto')
			.style('background', 'none repeat scroll 0 0 #ffffff')
	
		//initialize simulation
		///define variables from data for simulation only
		///data updates chart and restarts simulation later
		const links = this.data[this.mapping.edges];
		if(that.mapping.source){
			links.forEach(function(d){
				d.source = d[that.mapping.source];
				d.target = d[that.mapping.target];
			});
		}
		console.log(links);
    
		const nodes = this.data[this.mapping.nodes];
		console.log(nodes);
		
		/// define simulation object
		this.simulation = d3.forceSimulation(nodes)
			.force("charge", d3.forceManyBody().strength(-1))
			.force("link", d3.forceLink(links).distance(100))
			.force("collide", d3.forceCollide().radius(2))
			.force("x", d3.forceX())
			.force("y", d3.forceY())
			.alphaTarget(1)
			.on("tick", ticked);
			
		function ticked() {
		    that.node.selectAll('.node').attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; })
			
			//TODO: fix arrow marker by moving back based on the node radius
		    that.edge.selectAll('.edge').attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });
		}
    
		//this.setColorScales();
		this.nodeColor = d3.scaleOrdinal(d3.schemeCategory10);
		this.edgeColor = d3.scaleOrdinal(d3.schemeCategory10);
		// update chart
		// this.addZoom();
		this.update(this.data);
		
		function timeIt(){
		  setTimeout(function(){
			console.log("call stop");
			that.simulation.alpha(0).restart();
			that.simulation.stop();
			}, 20000);
		}
		timeIt();
	},
	update: function(newData){
		console.log(newData);
		//preserve context for functions
		const that = this;
		
		var data = newData.length == 1 ? newData[0] : newData;
    
		//define variables from data
		const links = data[this.mapping.edges];
		if(that.mapping.source){
			links.forEach(function(d){
			d.source = d[that.mapping.source];
			d.target = d[that.mapping.target];
			});
		}
    
		const nodes = data[this.mapping.nodes];
		
		// restart simulation with new data
		// node data join
		// TODO: add drag behavior
		var node = that.node.selectAll(".node").data(nodes);

		// node exit	
		node.exit()
			.transition()
			.ease(d3.easeQuad)
			.duration(1000)
			.remove();
			
		//node enter
		var newNode = node.enter()
			.append('circle')
			.attr('class', 'node')
			.on('mouseover', mouseOver)
			.on('mouseout', mouseOff);
       
		// node update	
		node.merge(newNode)
			.transition()
			.ease(d3.easeQuad)
			.duration(1000)
			.attr('fill', function(d){
				if(that.mapping.nodeGroup){
					return that.nodeColor(d[that.mapping.nodeGroup]);
				} else {
					return 'steelblue';
				}
			})
			.attr('r', function(d){
				if(that.mapping.nodeSize){
					return Math.min(75,Math.max(1, that.scores[d.index] * 1000));
				} else {
					return 5;
				}
			});
			
		// edge data join
		var edge = that.edge.selectAll('.edge').data(links);
		
		// edge exit
		edge.exit().remove();
		
		// edge enter
		var newEdge = edge.enter()
			.append('line')
			.attr('class', 'edge');
		
		edge.merge(newEdge)
			.transition()
			.ease(d3.easeQuad)
			.duration(1000)
			.attr("marker-end", "url(#arrow)")
			.attr('stroke-width', function(d){
				if(that.mapping.edgeSize){
					return d[that.mapping.edgeSize];
				} else {
					return 0.25;
				}
			})
			.attr('stroke', function(d){
				if(that.mapping.edgeGroup){
					return that.edgeColor(d[that.mapping.edgeGroup]);
				} else {
					return '#000';
				}
			});
				
		// Update and restart the simulation.
		that.simulation.nodes(nodes);
		that.simulation.force("link").links(links);
		that.simulation.alpha(1).restart();
		
		function mouseOver(){
			var data = d3.select(this).data()[0];
			var textDisplay = data[that.mapping.nodeLabel] + '-' + that.scores[data.index].toFixed(3);
			
			that.tooltip
			  .style("left", (d3.event.pageX - 10) + 'px')
			  .style("top", (d3.event.pageY - 30) + 'px')
			  .style("display", "inline-block")
			  .html(function(){
				  return textDisplay;
			  });
		}
		
		function mouseOff(){
			that.tooltip.style("display", "none");
		}
	}
	
});

module.exports = {
	sourceCredChartModel: sourceCredChartModel,
	sourceCredChartView: sourceCredChartView
};