terraform {
  required_providers {
    coder = {
      source = "coder/coder"
    }
    cloudinit = {
      source = "hashicorp/cloudinit"
    }
    aws = {
      source = "hashicorp/aws"
    }
  }
}

# Last updated 2023-03-14
# aws ec2 describe-regions | jq -r '[.Regions[].RegionName] | sort'
data "coder_parameter" "region" {
  name         = "region"
  display_name = "Region"
  description  = "The region to deploy the workspace in."
  default      = "us-east-1"
  mutable      = false
  option {
    name  = "Asia Pacific (Tokyo)"
    value = "ap-northeast-1"
    icon  = "/emojis/1f1ef-1f1f5.png"
  }
  option {
    name  = "Asia Pacific (Seoul)"
    value = "ap-northeast-2"
    icon  = "/emojis/1f1f0-1f1f7.png"
  }
  option {
    name  = "Asia Pacific (Osaka)"
    value = "ap-northeast-3"
    icon  = "/emojis/1f1ef-1f1f5.png"
  }
  option {
    name  = "Asia Pacific (Mumbai)"
    value = "ap-south-1"
    icon  = "/emojis/1f1ee-1f1f3.png"
  }
  option {
    name  = "Asia Pacific (Singapore)"
    value = "ap-southeast-1"
    icon  = "/emojis/1f1f8-1f1ec.png"
  }
  option {
    name  = "Asia Pacific (Sydney)"
    value = "ap-southeast-2"
    icon  = "/emojis/1f1e6-1f1fa.png"
  }
  option {
    name  = "Canada (Central)"
    value = "ca-central-1"
    icon  = "/emojis/1f1e8-1f1e6.png"
  }
  option {
    name  = "EU (Frankfurt)"
    value = "eu-central-1"
    icon  = "/emojis/1f1ea-1f1fa.png"
  }
  option {
    name  = "EU (Stockholm)"
    value = "eu-north-1"
    icon  = "/emojis/1f1ea-1f1fa.png"
  }
  option {
    name  = "EU (Ireland)"
    value = "eu-west-1"
    icon  = "/emojis/1f1ea-1f1fa.png"
  }
  option {
    name  = "EU (London)"
    value = "eu-west-2"
    icon  = "/emojis/1f1ea-1f1fa.png"
  }
  option {
    name  = "EU (Paris)"
    value = "eu-west-3"
    icon  = "/emojis/1f1ea-1f1fa.png"
  }
  option {
    name  = "South America (São Paulo)"
    value = "sa-east-1"
    icon  = "/emojis/1f1e7-1f1f7.png"
  }
  option {
    name  = "US East (N. Virginia)"
    value = "us-east-1"
    icon  = "/emojis/1f1fa-1f1f8.png"
  }
  option {
    name  = "US East (Ohio)"
    value = "us-east-2"
    icon  = "/emojis/1f1fa-1f1f8.png"
  }
  option {
    name  = "US West (N. California)"
    value = "us-west-1"
    icon  = "/emojis/1f1fa-1f1f8.png"
  }
  option {
    name  = "US West (Oregon)"
    value = "us-west-2"
    icon  = "/emojis/1f1fa-1f1f8.png"
  }
}

data "coder_parameter" "instance_type" {
  name         = "instance_type"
  display_name = "Instance type"
  description  = "What instance type should your workspace use?"
  default      = "t3.micro"
  mutable      = false
  option {
    name  = "2 vCPU, 1 GiB RAM"
    value = "t3.micro"
  }
  option {
    name  = "2 vCPU, 2 GiB RAM"
    value = "t3.small"
  }
  option {
    name  = "2 vCPU, 4 GiB RAM"
    value = "t3.medium"
  }
  option {
    name  = "2 vCPU, 8 GiB RAM"
    value = "t3.large"
  }
  option {
    name  = "4 vCPU, 16 GiB RAM"
    value = "t3.xlarge"
  }
  option {
    name  = "8 vCPU, 32 GiB RAM"
    value = "t3.2xlarge"
  }
}

provider "aws" {
  region = data.coder_parameter.region.value
}

data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] # Canonical
}

resource "coder_agent" "dev" {
  count          = data.coder_workspace.me.start_count
  arch           = "amd64"
  auth           = "aws-instance-identity"
  os             = "linux"
  startup_script = <<-EOT
    set -e

    # Add any commands that should be executed at workspace startup (e.g install requirements, start a program, etc) here
  EOT

  metadata {
    key          = "cpu"
    display_name = "CPU Usage"
    interval     = 5
    timeout      = 5
    script       = "coder stat cpu"
  }
  metadata {
    key          = "memory"
    display_name = "Memory Usage"
    interval     = 5
    timeout      = 5
    script       = "coder stat mem"
  }
  metadata {
    key          = "disk"
    display_name = "Disk Usage"
    interval     = 600 # every 10 minutes
    timeout      = 30  # df can take a while on large filesystems
    script       = "coder stat disk --path $HOME"
  }
}

# See https://registry.coder.com/modules/coder/code-server
module "code-server" {
  count  = data.coder_workspace.me.start_count
  source = "registry.coder.com/modules/code-server/coder"

  # This ensures that the latest non-breaking version of the module gets downloaded, you can also pin the module version to prevent breaking changes in production.
  version = "~> 1.0"

  agent_id = coder_agent.dev[0].id
  order    = 1
}

# See https://registry.coder.com/modules/coder/jetbrains
module "jetbrains" {
  count      = data.coder_workspace.me.start_count
  source     = "registry.coder.com/coder/jetbrains/coder"
  version    = "~> 1.0"
  agent_id   = coder_agent.dev[0].id
  agent_name = "dev"
  folder     = "/home/coder"
}

locals {
  hostname   = lower(data.coder_workspace.me.name)
  linux_user = "coder"
}

# ============================================================================
# IAM ROLE AND POLICY FOR EC2 (MSK Access)
# ============================================================================

# IAM Role for EC2 instance
resource "aws_iam_role" "ec2_msk_role" {
  name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-ec2-msk-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-ec2-msk-role"
  }
}

# IAM Policy for MSK access
resource "aws_iam_role_policy" "ec2_msk_policy" {
  name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-ec2-msk-policy"
  role = aws_iam_role.ec2_msk_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kafka-cluster:*",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "kafka:DescribeCluster",
          "kafka:GetBootstrapBrokers",
          "kafka:ListClusters",
        ]
        Resource = "*"
      }
    ]
  })
}

# Instance profile for EC2
resource "aws_iam_instance_profile" "ec2_msk_profile" {
  name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-ec2-msk-profile"
  role = aws_iam_role.ec2_msk_role.name
}

# ============================================================================
# AWS MSK (Managed Streaming for Apache Kafka) Configuration
# ============================================================================

# Create a VPC for the MSK cluster and EC2 instance
resource "aws_vpc" "workspace_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-vpc"
  }
}

# Create subnets for MSK (needs 3 AZs minimum or adjust)
resource "aws_subnet" "workspace_subnet_a" {
  vpc_id            = aws_vpc.workspace_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${data.coder_parameter.region.value}a"

  tags = {
    Name = "coder-subnet-a"
  }
}

resource "aws_subnet" "workspace_subnet_b" {
  vpc_id            = aws_vpc.workspace_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${data.coder_parameter.region.value}b"

  tags = {
    Name = "coder-subnet-b"
  }
}

# Security group for MSK
resource "aws_security_group" "msk_sg" {
  name   = "coder-${data.coder_workspace.me.name}-msk-sg"
  vpc_id = aws_vpc.workspace_vpc.id

  # Inbound: Allow Kafka traffic from EC2 security group
  ingress {
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  # Inbound: Allow Zookeeper traffic from EC2
  ingress {
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  # Outbound: Allow all traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "coder-${data.coder_workspace.me.name}-msk-sg"
  }
}

# Security group for EC2
resource "aws_security_group" "ec2_sg" {
  name   = "coder-${data.coder_workspace.me.name}-ec2-sg"
  vpc_id = aws_vpc.workspace_vpc.id

  # Inbound: SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Inbound: Node app port
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound: Allow all traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "coder-${data.coder_workspace.me.name}-ec2-sg"
  }
}

# Network interface for EC2 in the VPC
resource "aws_network_interface" "ec2_eni" {
  subnet_id       = aws_subnet.workspace_subnet_a.id
  security_groups = [aws_security_group.ec2_sg.id]

  tags = {
    Name = "coder-${data.coder_workspace.me.name}-eni"
  }
}

# AWS MSK Cluster
resource "aws_msk_cluster" "event_modeling_kafka" {
  cluster_name           = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-kafka"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 2

  broker_node_group_info {
    instance_type   = "kafka.t3.small"
    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
    client_subnets = [
      aws_subnet.workspace_subnet_a.id,
      aws_subnet.workspace_subnet_b.id,
    ]
    security_groups = [aws_security_group.msk_sg.id]
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  client_authentication {
    sasl {
      iam = true
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk_logs.name
      }
    }
  }

  tags = {
    Name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-kafka"
  }

  depends_on = [
    aws_security_group.msk_sg
  ]
}

# CloudWatch Log Group for MSK
resource "aws_cloudwatch_log_group" "msk_logs" {
  name              = "/aws/msk/coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}"
  retention_in_days = 7

  tags = {
    Name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-msk-logs"
  }
}

data "cloudinit_config" "user_data" {
  gzip          = false
  base64_encode = false

  boundary = "//"

  part {
    filename     = "cloud-config.yaml"
    content_type = "text/cloud-config"

    content = templatefile("${path.module}/cloud-init/cloud-config.yaml.tftpl", {
      hostname   = local.hostname
      linux_user = local.linux_user
    })
  }

  part {
    filename     = "userdata.sh"
    content_type = "text/x-shellscript"

    content = templatefile("${path.module}/cloud-init/userdata.sh.tftpl", {
      linux_user = local.linux_user

      init_script = try(coder_agent.dev[0].init_script, "")
    })
  }
}

resource "aws_instance" "dev" {
  ami               = data.aws_ami.ubuntu.id
  availability_zone = "${data.coder_parameter.region.value}a"
  instance_type     = data.coder_parameter.instance_type.value
  iam_instance_profile = aws_iam_instance_profile.ec2_msk_profile.name
  
  network_interface {
    network_interface_id = aws_network_interface.ec2_eni.id
    device_index         = 0
  }

  user_data = data.cloudinit_config.user_data.rendered

  # Pass MSK broker endpoints to EC2 instance via environment variable
  user_data_replace_on_change = true

  tags = {
    Name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}"
    # Required if you are using our example policy, see template README
    Coder_Provisioned = "true"
  }
  lifecycle {
    ignore_changes = [ami]
  }

  depends_on = [
    aws_msk_cluster.event_modeling_kafka,
    aws_iam_instance_profile.ec2_msk_profile
  ]
}

resource "coder_metadata" "workspace_info" {
  resource_id = aws_instance.dev.id
  item {
    key   = "region"
    value = data.coder_parameter.region.value
  }
  item {
    key   = "instance type"
    value = aws_instance.dev.instance_type
  }
  item {
    key   = "disk"
    value = "${aws_instance.dev.root_block_device[0].volume_size} GiB"
  }
  item {
    key   = "msk cluster"
    value = aws_msk_cluster.event_modeling_kafka.cluster_name
  }
  item {
    key   = "msk brokers"
    value = aws_msk_cluster.event_modeling_kafka.bootstrap_brokers
  }
}

# Output MSK broker endpoints for easy access
output "msk_bootstrap_brokers" {
  description = "MSK Bootstrap Brokers - Use this for AWS_MSK_BROKERS"
  value       = aws_msk_cluster.event_modeling_kafka.bootstrap_brokers
}

output "msk_bootstrap_brokers_tls" {
  description = "MSK Bootstrap Brokers TLS - Use this if TLS is enabled"
  value       = aws_msk_cluster.event_modeling_kafka.bootstrap_brokers_tls
}

output "msk_cluster_name" {
  description = "MSK Cluster Name"
  value       = aws_msk_cluster.event_modeling_kafka.cluster_name
}

output "msk_cluster_arn" {
  description = "MSK Cluster ARN"
  value       = aws_msk_cluster.event_modeling_kafka.arn
}

output "ec2_instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.dev.id
}

output "ec2_private_ip" {
  description = "EC2 Private IP Address"
  value       = aws_instance.dev.private_ip
}

resource "aws_ec2_instance_state" "dev" {
  instance_id = aws_instance.dev.id
  state       = data.coder_workspace.me.transition == "start" ? "running" : "stopped"
}